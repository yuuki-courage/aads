#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadCampaignLayerPolicy } from "./config/campaign-layer-policy.js";
import { loadOptimisationConfig } from "./config/optimisation-config.js";
import { Logger } from "./utils/logger.js";
import { runAnalyzePipeline } from "./pipeline/analyze-pipeline.js";
import { runGeneratePipeline } from "./pipeline/generate-pipeline.js";
import { writeXlsx } from "./io/excel-writer.js";
import { bulkRowToArray } from "./generators/row-builders.js";
import { BULK_SCHEMA_HEADER_V210, B500_CAMPAIGN_HEADER } from "./config/constants.js";
import { timestampForFilename } from "./utils/date-utils.js";
import { generateActionItemRows } from "./generators/apply-actions.js";
import { generateCampaignTemplate } from "./generators/campaign-template.js";
import { validateCampaignTemplateConfig } from "./config/campaign-template-defaults.js";
import type { AnalyzePipelineResult, OutputFormat, StrategyData, ActionItemsConfig } from "./pipeline/types.js";
import type { CampaignTemplateConfig } from "./config/campaign-template-defaults.js";
import type { CampaignLayerId } from "./config/campaign-layer-policy.js";

const logger = new Logger(process.env.LOG_LEVEL === "debug" ? "debug" : "info");

const toPct = (value: number): string => `${(value * 100).toFixed(2)}%`;

const printLayerSummary = async (result: AnalyzePipelineResult, layerPolicyPath?: string): Promise<void> => {
  if (!result.layerClassification || result.layerClassification.length === 0) return;

  const policy = await loadCampaignLayerPolicy(layerPolicyPath);
  if (!policy) return;

  const LAYER_ORDER: CampaignLayerId[] = ["L0", "L1", "L2", "L3", "L4"];
  const metricsMap = new Map(result.campaignMetrics.map((m) => [m.campaignName, m]));

  const layerAgg = LAYER_ORDER.map((layerId) => {
    const layer = policy.layers[layerId];
    const classified = result.layerClassification!.filter((c) => c.layer === layerId);
    let totalSpend = 0;
    let totalSales = 0;
    let allPaused = true;
    for (const c of classified) {
      const m = metricsMap.get(c.campaignName);
      if (m) {
        totalSpend += m.spend;
        totalSales += m.sales;
        if (m.state !== "paused") allPaused = false;
      }
    }
    const acos = totalSales > 0 ? totalSpend / totalSales : 0;
    return {
      layer: layerId,
      name: layer.name,
      campaigns: classified.length,
      spend: totalSpend,
      sales: totalSales,
      acos,
      paused: classified.length > 0 && allPaused,
    };
  });

  const totalSpend = layerAgg.reduce((sum, l) => sum + l.spend, 0);

  console.log("\nLayer Summary");
  console.table(
    layerAgg.map((row) => ({
      Layer: row.layer,
      Name: row.name,
      Campaigns: row.campaigns,
      Spend: `¥${Math.round(row.spend).toLocaleString()}`,
      Sales: `¥${Math.round(row.sales).toLocaleString()}`,
      ACOS: row.sales > 0 ? toPct(row.acos) : "-",
      "Budget%": totalSpend > 0 ? toPct(row.spend / totalSpend) : "-",
      Note: row.paused ? "(paused)" : "",
    })),
  );

  const lowConfidence = result.layerClassification.filter((c) => c.confidence === "low");
  if (lowConfidence.length > 0) {
    console.log(`\n⚠ ${lowConfidence.length} campaign(s) classified with low confidence (fallback):`);
    for (const c of lowConfidence) {
      console.log(`  - ${c.campaignName} → ${c.layer}`);
    }
  }
};

const toOutputFormat = (value: string | undefined, fallback: OutputFormat = "console"): OutputFormat => {
  const raw = String(value ?? fallback)
    .trim()
    .toLowerCase();
  if (raw === "console" || raw === "json" || raw === "markdown" || raw === "xlsx") {
    return raw;
  }
  return fallback;
};

const writeTextFile = async (filePath: string, content: string): Promise<void> => {
  const resolved = path.resolve(filePath);
  await mkdir(path.dirname(resolved), { recursive: true });
  await writeFile(resolved, content, "utf8");
};

const program = new Command();

program
  .name("aads")
  .description("CLI tool for analyzing Amazon Ads Sponsored Products campaign performance")
  .version("1.2.0");

program
  .command("analyze")
  .description("Analyze bulk sheet KPIs (CTR, CVR, ACOS, ROAS)")
  .requiredOption("--input <pattern>", "Input Excel/CSV path or wildcard pattern")
  .option("--layer-policy <file>", "Campaign layer policy JSON path")
  .action(async (options: { input: string; layerPolicy?: string }) => {
    const config = loadOptimisationConfig();
    const result = await runAnalyzePipeline(options.input, config, {
      layerPolicyPath: options.layerPolicy,
    });

    const totals = result.records.reduce(
      (acc, row) => {
        acc.clicks += row.clicks;
        acc.impressions += row.impressions;
        acc.spend += row.spend;
        acc.sales += row.sales;
        acc.orders += row.orders;
        return acc;
      },
      { clicks: 0, impressions: 0, spend: 0, sales: 0, orders: 0 },
    );

    logger.info("Analyze completed", {
      files: new Set(result.input.map((i) => i.sourceFile.replace(/#.*$/, ""))).size,
      rows: result.records.length,
      period: result.dateRange
        ? `${result.dateRange.startDate} ~ ${result.dateRange.endDate} (${result.dateRange.days}d)`
        : "unknown",
      campaigns: result.campaignMetrics.length,
      clicks: totals.clicks,
      impressions: totals.impressions,
      spend: totals.spend,
      sales: totals.sales,
      orders: totals.orders,
      ctr: toPct(totals.impressions > 0 ? totals.clicks / totals.impressions : 0),
      cvr: toPct(totals.clicks > 0 ? totals.orders / totals.clicks : 0),
      acos: toPct(totals.sales > 0 ? totals.spend / totals.sales : 0),
      roas: totals.spend > 0 ? (totals.sales / totals.spend).toFixed(2) : "0.00",
    });
  });

program
  .command("summary")
  .description("Campaign structure summary with layer-level aggregation")
  .requiredOption("--input <pattern>", "Input Excel/CSV path or wildcard pattern")
  .option("--layer-policy <file>", "Campaign layer policy JSON path")
  .action(async (options: { input: string; layerPolicy?: string }) => {
    const config = loadOptimisationConfig();
    const result = await runAnalyzePipeline(options.input, config, {
      layerPolicyPath: options.layerPolicy,
    });

    console.log("\nCampaign KPI Summary");
    console.table(
      result.campaignMetrics.slice(0, 20).map((item) => ({
        campaign: item.campaignName,
        clicks: item.clicks,
        spend: Math.round(item.spend),
        sales: Math.round(item.sales),
        acos: toPct(item.acos),
        roas: item.roas.toFixed(2),
      })),
    );

    console.log("\nStructure Summary");
    console.table(
      result.structure.slice(0, 20).map((campaign) => ({
        campaign: campaign.campaignName,
        adGroups: campaign.adGroups.length,
        keywords: campaign.adGroups.reduce((sum, g) => sum + g.keywordCount, 0),
        productTargets: campaign.adGroups.reduce((sum, g) => sum + g.productTargetCount, 0),
      })),
    );

    await printLayerSummary(result, options.layerPolicy);
  });

program
  .command("cpc-report")
  .description("CPC bid optimization report with SEO ranking integration")
  .requiredOption("--input <pattern>", "Input Excel/CSV path or wildcard pattern")
  .requiredOption("--output <file>", "Output xlsx path")
  .option("--ranking-db <path>", "A_rank SQLite DB path for SEO-based CPC adjustment")
  .action(async (options: { input: string; output: string; rankingDb?: string }) => {
    const config = loadOptimisationConfig();
    const analyzed = await runAnalyzePipeline(options.input, config, {
      rankingDbPath: options.rankingDb,
    });

    const header = [
      "Campaign",
      "Ad Group",
      "Keyword",
      "Clicks(14d)",
      "AvgCPC(14d)",
      "CurrentBid",
      "RecommendedBid",
      "BidAdjust",
      "OrganicPos",
      "SeoFactor",
      "Reason",
    ];
    const rows = analyzed.cpcRecommendations.map((item) => [
      item.campaignName,
      item.adGroupName,
      item.keywordText,
      item.clicks,
      Math.round(item.avgCpc),
      Math.round(item.currentBid),
      item.recommendedBid,
      item.bidAdjust.toFixed(2),
      item.organicPosition != null ? `#${item.organicPosition}` : "-",
      item.seoFactor != null ? item.seoFactor.toFixed(2) : "-",
      item.reason,
    ]);

    await writeXlsx(options.output, [{ name: "CPC_Optimisation_Report", header, rows }]);
    logger.info("CPC report completed", {
      output: options.output,
      rows: rows.length,
      seoEnabled: Boolean(analyzed.seoRankingData),
    });
  });

program
  .command("promotion-report")
  .description("Auto-to-Manual promotion candidates and negative keyword suggestions")
  .requiredOption("--input <pattern>", "Input Excel/CSV path or wildcard pattern")
  .requiredOption("--output <file>", "Output xlsx path")
  .action(async (options: { input: string; output: string }) => {
    const config = loadOptimisationConfig();
    const analyzed = await runAnalyzePipeline(options.input, config);

    const promotionHeader = [
      "Auto Campaign",
      "Ad Group",
      "Search Term",
      "Clicks",
      "Spend",
      "CVR(%)",
      "Suggested Match Type",
      "Suggested Bid",
      "Suggested Ad Group",
    ];
    const promotionRows = analyzed.promotionCandidates.map((item) => [
      item.campaignName,
      item.adGroupName,
      item.keywordText,
      item.clicks,
      Math.round(item.spend),
      (item.cvr * 100).toFixed(2),
      item.matchType,
      item.recommendedBid,
      item.recommendedAdGroupName,
    ]);

    const negativeHeader = ["Campaign", "Ad Group", "Term", "MatchType", "Reason"];
    const negativeRows = analyzed.negativeCandidates.map((item) => [
      item.campaignName,
      item.adGroupName,
      item.keywordText,
      item.matchType,
      item.reason,
    ]);

    await writeXlsx(options.output, [
      { name: "AutoToManual_Report", header: promotionHeader, rows: promotionRows },
      { name: "Negative_Keyword_Optimisation", header: negativeHeader, rows: negativeRows },
    ]);
    logger.info("Promotion report completed", {
      output: options.output,
      promotionRows: promotionRows.length,
      negativeRows: negativeRows.length,
    });
  });

program
  .command("seo-report")
  .description("SEO ranking vs ad keyword integrated report")
  .requiredOption("--input <pattern>", "Input Excel/CSV path or wildcard pattern")
  .requiredOption("--ranking-db <path>", "A_rank SQLite DB path")
  .option("--output <file>", "Output xlsx path")
  .option("--format <type>", "console | json | xlsx", "console")
  .action(async (options: { input: string; rankingDb: string; output?: string; format?: string }) => {
    const config = loadOptimisationConfig();
    const analyzed = await runAnalyzePipeline(options.input, config, {
      rankingDbPath: options.rankingDb,
    });

    if (!analyzed.seoRankingData) {
      logger.error("No SEO ranking data available. Check --ranking-db path and SEO_ENABLED setting.");
      process.exitCode = 1;
      return;
    }

    const seoItems = analyzed.cpcRecommendations.map((rec) => ({
      campaign: rec.campaignName,
      adGroup: rec.adGroupName,
      keyword: rec.keywordText,
      clicks: rec.clicks,
      avgCpc: Math.round(rec.avgCpc),
      currentBid: Math.round(rec.currentBid),
      recommendedBid: rec.recommendedBid,
      organicPos: rec.organicPosition != null ? rec.organicPosition : null,
      seoFactor: rec.seoFactor ?? 1.0,
      reason: rec.reason,
    }));

    const format = toOutputFormat(options.format, "console");

    if (format === "json") {
      const content = JSON.stringify(
        {
          dbPath: analyzed.seoRankingData.dbPath,
          snapshotDate: analyzed.seoRankingData.snapshotDate,
          matchedKeywords: analyzed.seoRankingData.rankings.size,
          items: seoItems,
        },
        null,
        2,
      );
      if (options.output) {
        await writeTextFile(options.output, content);
        logger.info("SEO report JSON saved", { output: options.output });
      } else {
        console.log(content);
      }
      return;
    }

    if (format === "xlsx" || (options.output && options.output.toLowerCase().endsWith(".xlsx"))) {
      const outputPath = options.output ?? path.resolve("output", `seo-report-${timestampForFilename()}.xlsx`);
      const header = [
        "Campaign",
        "Ad Group",
        "Keyword",
        "Clicks(14d)",
        "AvgCPC",
        "CurrentBid",
        "RecommendedBid",
        "OrganicPos",
        "SeoFactor",
        "Reason",
      ];
      const rows = seoItems.map((item) => [
        item.campaign,
        item.adGroup,
        item.keyword,
        item.clicks,
        item.avgCpc,
        item.currentBid,
        item.recommendedBid,
        item.organicPos != null ? item.organicPos : "-",
        item.seoFactor.toFixed(2),
        item.reason,
      ]);

      await writeXlsx(outputPath, [{ name: "SEO_Report", header, rows }]);
      logger.info("SEO report generated", {
        output: outputPath,
        rows: rows.length,
        matchedKeywords: analyzed.seoRankingData.rankings.size,
      });
      return;
    }

    // Console output
    console.log("\nSEO Ranking Report");
    console.log(`DB: ${analyzed.seoRankingData.dbPath}`);
    console.log(`Snapshot: ${analyzed.seoRankingData.snapshotDate}`);
    console.log(`Matched keywords: ${analyzed.seoRankingData.rankings.size}`);
    console.log("");

    const seoAdjusted = seoItems.filter((item) => item.seoFactor < 1.0);
    if (seoAdjusted.length > 0) {
      console.log("SEO-adjusted keywords:");
      console.table(
        seoAdjusted.map((item) => ({
          keyword: item.keyword,
          organicPos: item.organicPos != null ? `#${item.organicPos}` : "-",
          seoFactor: item.seoFactor.toFixed(2),
          currentBid: item.currentBid,
          recommendedBid: item.recommendedBid,
        })),
      );
    } else {
      console.log("No keywords with SEO adjustment (all factors = 1.0)");
    }

    console.log(`\nTotal CPC recommendations: ${seoItems.length}`);
    console.log(`SEO-adjusted: ${seoAdjusted.length}`);
  });

program
  .command("generate")
  .description("Generate Amazon Ads bulk sheet from analysis results")
  .requiredOption("--input <pattern>", "Input Excel/CSV path or wildcard pattern")
  .requiredOption("--output <file>", "Output xlsx path")
  .option("--blocks <list>", "Comma-separated block numbers to run (1,2,3,3.5,4,5)", "")
  .action(async (options: { input: string; output: string; blocks: string }) => {
    const config = loadOptimisationConfig();
    const analyzed = await runAnalyzePipeline(options.input, config);

    const blocks = options.blocks
      ? options.blocks
          .split(",")
          .map((b) => Number.parseFloat(b.trim()))
          .filter((n) => !Number.isNaN(n))
      : [];

    const strategy: StrategyData = { source: "none" };

    const result = runGeneratePipeline({
      analyzeResult: analyzed,
      config,
      strategy,
      blocks,
    });

    const header = [...BULK_SCHEMA_HEADER_V210];
    const rows = result.rows.map((r) => bulkRowToArray(r));

    await writeXlsx(options.output, [{ name: "Bulk_Sheet", header, rows }]);

    logger.info("Bulk sheet generated", {
      output: options.output,
      ...result.summary.blockCounts,
      totalRows: result.summary.totalRows,
    });
  });

program
  .command("apply-actions")
  .description("Apply action items to generate a bulk sheet for batch operations")
  .requiredOption("--config <file>", "Action items config JSON path")
  .requiredOption("--output <file>", "Output xlsx path")
  .action(async (options: { config: string; output: string }) => {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(path.resolve(options.config), "utf8");
    const parsed = JSON.parse(raw) as ActionItemsConfig;

    if (!parsed.actions || !Array.isArray(parsed.actions)) {
      logger.error("Invalid config: 'actions' must be an array");
      process.exitCode = 1;
      return;
    }

    const rows = generateActionItemRows(parsed.actions);
    const header = [...BULK_SCHEMA_HEADER_V210];
    const arrayRows = rows.map((r) => bulkRowToArray(r));

    await writeXlsx(options.output, [{ name: "Action_Items", header, rows: arrayRows }]);

    // Summary by type
    const typeCounts: Record<string, number> = {};
    for (const action of parsed.actions) {
      typeCounts[action.type] = (typeCounts[action.type] ?? 0) + 1;
    }

    logger.info("Action items applied", {
      output: options.output,
      totalRows: rows.length,
      ...typeCounts,
    });
  });

program
  .command("create-campaign")
  .description("Generate campaign structure bulk sheet from template config")
  .requiredOption("--config <file>", "Campaign template config JSON path")
  .requiredOption("--output <file>", "Output xlsx path")
  .option("--mode <mode>", "create or update", "create")
  .option("--input <file>", "SC bulk sheet for update mode (required when --mode=update)")
  .action(
    async (options: { config: string; output: string; mode: string; input?: string }) => {
      const { readFile } = await import("node:fs/promises");
      const raw = await readFile(path.resolve(options.config), "utf8");
      const config = JSON.parse(raw) as CampaignTemplateConfig;

      const validation = validateCampaignTemplateConfig(config);
      if (!validation.valid) {
        logger.error("Invalid campaign template config", { errors: validation.errors });
        process.exitCode = 1;
        return;
      }

      const mode = options.mode === "update" ? "update" : "create";

      if (mode === "update" && !options.input) {
        logger.error("--input is required for update mode");
        process.exitCode = 1;
        return;
      }

      let updateCtx;
      if (mode === "update" && options.input) {
        const optimConfig = loadOptimisationConfig();
        const analyzeResult = await runAnalyzePipeline(options.input, optimConfig);
        updateCtx = { analyzeResult };
      }

      const { rows, warnings } = generateCampaignTemplate(config, mode, updateCtx);

      for (const w of warnings) {
        logger.warn(w);
      }

      const header = mode === "create" ? [...B500_CAMPAIGN_HEADER] : [...BULK_SCHEMA_HEADER_V210];
      const arrayRows = rows.map((r) => bulkRowToArray(r));

      await writeXlsx(options.output, [{ name: "Campaign_Template", header, rows: arrayRows }]);

      logger.info("Campaign template generated", {
        output: options.output,
        mode,
        totalRows: rows.length,
        warnings: warnings.length,
      });
    },
  );

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Command failed", { error: message });
  process.exitCode = 1;
});
