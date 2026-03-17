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
import {
  MEASURE_KPI_LABELS,
  addMeasureLog,
  addNoteToMeasureLog,
  calcMeasureReminder,
  compareMeasureEffect,
  getMeasureLogById,
  getMeasurePatternById,
  listMeasureLogs,
  loadMeasurePatterns,
  removeMeasureLog,
  saveMeasureCompareToLog,
  updateMeasureLog,
} from "./analysis/measure-effect.js";
import { runMeasureLlmAnalysis } from "./research/measure-llm.js";
import type {
  AnalyzePipelineResult,
  OutputFormat,
  StrategyData,
  ActionItemsConfig,
  MeasureCompareResult,
  MeasureKpiDiff,
  MeasureKpiKey,
  MeasureLogEntry,
  MeasureLogStatus,
  MeasurePattern,
} from "./pipeline/types.js";
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
  .action(async (options: { config: string; output: string; mode: string; input?: string }) => {
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
  });

// === measure helpers ===

const parseCsvList = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v !== "");
};

const toMeasureLogStatus = (value?: string): MeasureLogStatus | undefined => {
  if (!value) return undefined;
  const raw = value.trim().toLowerCase();
  if (raw === "pending" || raw === "monitoring" || raw === "completed" || raw === "archived") return raw;
  return undefined;
};

const isRatioKpi = (kpi: MeasureKpiKey): boolean => kpi === "ctr" || kpi === "cvr" || kpi === "acos";
const isCurrencyKpi = (kpi: MeasureKpiKey): boolean =>
  kpi === "spend" || kpi === "sales" || kpi === "cpc" || kpi === "cpa";

const formatMeasureKpiValue = (kpi: MeasureKpiKey, value: number): string => {
  if (isRatioKpi(kpi)) return toPct(value);
  if (kpi === "roas") return value.toFixed(2);
  if (isCurrencyKpi(kpi)) return Math.round(value).toLocaleString();
  return Math.round(value).toLocaleString();
};

const formatMeasureKpiDiffValue = (kpi: MeasureKpiKey, diff: number): string => {
  const sign = diff >= 0 ? "+" : "-";
  const abs = Math.abs(diff);
  if (isRatioKpi(kpi)) return `${sign}${(abs * 100).toFixed(2)}pt`;
  if (kpi === "roas") return `${sign}${abs.toFixed(2)}`;
  if (isCurrencyKpi(kpi)) return `${sign}${Math.round(abs).toLocaleString()}`;
  return `${sign}${Math.round(abs).toLocaleString()}`;
};

const formatChangeRate = (changeRate: number): string => {
  const sign = changeRate >= 0 ? "+" : "";
  return `${sign}${(changeRate * 100).toFixed(2)}%`;
};

const formatHypothesisConfidence = (value: "high" | "medium" | "low"): string => value;

const toVerdictLabel = (verdict: MeasureCompareResult["verdict"]): string => {
  if (verdict === "improved") return "improved";
  if (verdict === "degraded") return "degraded";
  return "neutral";
};

const toMeasureCompareMarkdown = (result: MeasureCompareResult): string => {
  const focusRows = result.focusDiffs
    .map((item) => {
      const kpiLabel = MEASURE_KPI_LABELS[item.kpi];
      return `| ${kpiLabel} | ${formatMeasureKpiValue(item.kpi, item.before)} | ${formatMeasureKpiValue(item.kpi, item.after)} | ${formatMeasureKpiDiffValue(item.kpi, item.diff)} | ${formatChangeRate(item.changeRate)} |`;
    })
    .join("\n");

  const criteriaRows = result.criteriaEvaluations
    .map((item) => {
      const pass = item.passed ? "pass" : "fail";
      return `| ${item.criterion.label} | ${MEASURE_KPI_LABELS[item.criterion.kpi]} | ${item.criterion.direction} | ${(item.criterion.threshold * 100).toFixed(2)}% | ${formatChangeRate(item.changeRate)} | ${pass} |`;
    })
    .join("\n");

  const campaignRows = result.campaignDiffs
    .slice(0, 20)
    .map((item) => {
      const status = item.isNew ? "new" : item.isRemoved ? "removed" : "";
      return `| ${item.campaignName} | ${status} | ${formatMeasureKpiValue("sales", item.before.sales)} | ${formatMeasureKpiValue("sales", item.after.sales)} | ${formatChangeRate((item.after.sales - item.before.sales) / Math.max(Math.abs(item.before.sales), 1))} | ${toPct(item.before.acos)} | ${toPct(item.after.acos)} |`;
    })
    .join("\n");

  const budgetSimulationRows = result.budgetSimulation
    ? [
        `| Before Daily Budget | ${Math.round(result.budgetSimulation.beforeTotalDailyBudget).toLocaleString()} |`,
        `| After Daily Budget | ${Math.round(result.budgetSimulation.afterTotalDailyBudget).toLocaleString()} |`,
        `| Budget Change | ${formatChangeRate(result.budgetSimulation.budgetChangeRate)} |`,
        `| Before ROAS | ${result.budgetSimulation.beforeRoas.toFixed(2)} |`,
        `| Expected Daily Sales | ${Math.round(result.budgetSimulation.expectedDailySales).toLocaleString()} |`,
        `| Actual Daily Sales | ${Math.round(result.budgetSimulation.actualDailySales).toLocaleString()} |`,
        `| Expected vs Actual | ${formatChangeRate(result.budgetSimulation.expectedVsActualRate)} |`,
      ].join("\n")
    : "";

  const budgetCampaignRows = result.budgetSimulation?.campaignBudgetDiffs
    .slice(0, 20)
    .map((item) => {
      const status = item.isNew ? "new" : item.isRemoved ? "removed" : "";
      return `| ${item.campaignName} | ${status} | ${Math.round(item.beforeDailyBudget).toLocaleString()} | ${Math.round(item.afterDailyBudget).toLocaleString()} | ${formatChangeRate(item.budgetChangeRate)} |`;
    })
    .join("\n");

  const hypothesisRows = (result.hypotheses ?? [])
    .map((item) => {
      return `| ${item.id} | ${item.pattern} | ${item.hypothesis} | ${formatHypothesisConfidence(item.confidence)} | ${item.suggestedAction} | ${item.suggestedMetrics.join(" / ")} |`;
    })
    .join("\n");

  const budgetSection = result.budgetSimulation
    ? [
        "",
        "## Budget Simulation",
        "| Item | Value |",
        "|---|---:|",
        budgetSimulationRows,
        "",
        "### Campaign Budget Diff (Top 20 by budget delta)",
        "| Campaign | Status | DailyBudget(Before) | DailyBudget(After) | Budget Change |",
        "|---|---|---:|---:|---:|",
        budgetCampaignRows || "| - | - | - | - | - |",
      ].join("\n")
    : "";

  const hypothesisSection =
    (result.hypotheses?.length ?? 0) > 0
      ? [
          "",
          "## Hypotheses",
          "| ID | Pattern | Hypothesis | Confidence | Suggested Action | Suggested Metrics |",
          "|---|---|---|---|---|---|",
          hypothesisRows,
        ].join("\n")
      : "";

  const dateRangeLine =
    result.beforeDateRange && result.afterDateRange
      ? `- Before: ${result.beforeDateRange.startDate} - ${result.beforeDateRange.endDate} (${result.beforeDateRange.days}d)\n- After: ${result.afterDateRange.startDate} - ${result.afterDateRange.endDate} (${result.afterDateRange.days}d)`
      : "- Date range: unknown";

  const llmSection = result.llmAnalysis ? `\n## LLM Analysis\n\n${result.llmAnalysis}\n` : "";

  return [
    `# Measure Effect Report: ${result.measureName ?? result.patternName}`,
    "",
    `GeneratedAt: ${result.generatedAt}`,
    `Pattern: ${result.patternName} (${result.patternId})`,
    `Verdict: ${toVerdictLabel(result.verdict)}`,
    "",
    "## Date Range",
    dateRangeLine,
    "",
    "## Focus KPI Diff",
    "| KPI | Before | After | Diff | Change |",
    "|---|---:|---:|---:|---:|",
    focusRows || "| - | - | - | - | - |",
    "",
    "## Criteria Evaluation",
    "| Criteria | KPI | Direction | Threshold | Change | Result |",
    "|---|---|---|---:|---:|---|",
    criteriaRows || "| - | - | - | - | - | - |",
    "",
    "## Campaign Diff (Top 20 by sales delta)",
    "| Campaign | Status | Sales(Before) | Sales(After) | Sales Change | ACOS(Before) | ACOS(After) |",
    "|---|---|---:|---:|---:|---:|---:|",
    campaignRows || "| - | - | - | - | - | - | - |",
    budgetSection,
    hypothesisSection,
    llmSection,
  ].join("\n");
};

const printMeasureCompareConsole = (result: MeasureCompareResult): void => {
  console.log("\nMeasure Effect Compare");
  console.log(`Pattern: ${result.patternName} (${result.patternId})`);
  console.log(`Verdict: ${toVerdictLabel(result.verdict)}`);
  if (result.measureName) console.log(`Measure: ${result.measureName}`);
  if (result.beforeDateRange) {
    console.log(
      `Before: ${result.beforeDateRange.startDate} - ${result.beforeDateRange.endDate} (${result.beforeDateRange.days}d)`,
    );
  }
  if (result.afterDateRange) {
    console.log(
      `After : ${result.afterDateRange.startDate} - ${result.afterDateRange.endDate} (${result.afterDateRange.days}d)`,
    );
  }
  console.log("\nFocus KPI");
  console.table(
    result.focusDiffs.map((item) => ({
      kpi: MEASURE_KPI_LABELS[item.kpi],
      before: formatMeasureKpiValue(item.kpi, item.before),
      after: formatMeasureKpiValue(item.kpi, item.after),
      diff: formatMeasureKpiDiffValue(item.kpi, item.diff),
      change: formatChangeRate(item.changeRate),
    })),
  );

  if (result.criteriaEvaluations.length > 0) {
    console.log("\nCriteria");
    console.table(
      result.criteriaEvaluations.map((item) => ({
        criteria: item.criterion.label,
        kpi: MEASURE_KPI_LABELS[item.criterion.kpi],
        direction: item.criterion.direction,
        threshold: `${(item.criterion.threshold * 100).toFixed(2)}%`,
        change: formatChangeRate(item.changeRate),
        result: item.passed ? "pass" : "fail",
      })),
    );
  }

  if (result.budgetSimulation) {
    console.log("\nBudget Simulation");
    console.table([
      {
        beforeDailyBudget: Math.round(result.budgetSimulation.beforeTotalDailyBudget).toLocaleString(),
        afterDailyBudget: Math.round(result.budgetSimulation.afterTotalDailyBudget).toLocaleString(),
        budgetChange: formatChangeRate(result.budgetSimulation.budgetChangeRate),
        beforeRoas: result.budgetSimulation.beforeRoas.toFixed(2),
        expectedDailySales: Math.round(result.budgetSimulation.expectedDailySales).toLocaleString(),
        actualDailySales: Math.round(result.budgetSimulation.actualDailySales).toLocaleString(),
        expectedVsActual: formatChangeRate(result.budgetSimulation.expectedVsActualRate),
      },
    ]);

    console.log("\nCampaign Budget Diff (Top 10)");
    console.table(
      result.budgetSimulation.campaignBudgetDiffs.slice(0, 10).map((item) => ({
        campaign: item.campaignName,
        status: item.isNew ? "new" : item.isRemoved ? "removed" : "",
        beforeDailyBudget: Math.round(item.beforeDailyBudget).toLocaleString(),
        afterDailyBudget: Math.round(item.afterDailyBudget).toLocaleString(),
        budgetChange: formatChangeRate(item.budgetChangeRate),
      })),
    );
  }

  console.log("\nCampaign Diff (Top 10)");
  console.table(
    result.campaignDiffs.slice(0, 10).map((item) => ({
      campaign: item.campaignName,
      status: item.isNew ? "new" : item.isRemoved ? "removed" : "",
      salesBefore: formatMeasureKpiValue("sales", item.before.sales),
      salesAfter: formatMeasureKpiValue("sales", item.after.sales),
      salesChange: formatChangeRate((item.after.sales - item.before.sales) / Math.max(Math.abs(item.before.sales), 1)),
      acosBefore: toPct(item.before.acos),
      acosAfter: toPct(item.after.acos),
    })),
  );

  if ((result.hypotheses?.length ?? 0) > 0) {
    console.log("\nHypotheses");
    console.table(
      (result.hypotheses ?? []).map((item) => ({
        id: item.id,
        pattern: item.pattern,
        confidence: formatHypothesisConfidence(item.confidence),
        hypothesis: item.hypothesis,
        suggestedAction: item.suggestedAction,
        suggestedMetrics: item.suggestedMetrics.join(" / "),
      })),
    );
  }

  if (result.llmAnalysis) {
    console.log("\nLLM Analysis");
    console.log(result.llmAnalysis);
  }
};

const toMeasureLogMarkdown = (entries: MeasureLogEntry[], patternMap: Map<string, MeasurePattern>): string => {
  const now = new Date();
  const rows = entries
    .map((entry) => {
      const pattern = patternMap.get(entry.patternId);
      const patternName = pattern?.name ?? entry.patternId;
      const { reminder } = pattern ? calcMeasureReminder(entry, pattern, now) : { reminder: "" };
      const notesCount = entry.notes?.length ?? 0;
      const notesSummary = notesCount > 0 ? `${notesCount}件` : "-";
      return `| ${entry.id} | ${entry.date} | ${patternName} | ${entry.name} | ${entry.status} | ${notesSummary} | ${reminder} |`;
    })
    .join("\n");
  return [
    "| ID | Date | Pattern | Name | Status | Notes | Reminder |",
    "|---|---|---|---|---|---|---|",
    rows || "| - | - | - | - | - | - | - |",
  ].join("\n");
};

const getDiffByKpi = (diffs: MeasureKpiDiff[], kpi: MeasureKpiKey): MeasureKpiDiff | undefined => {
  return diffs.find((item) => item.kpi === kpi);
};

const writeMeasureCompareXlsx = async (outputPath: string, result: MeasureCompareResult): Promise<void> => {
  const overallSheet = {
    name: "Overall_Diff",
    header: ["KPI", "Before", "After", "Diff", "ChangeRate"],
    rows: result.overallDiffs.map((item) => [item.kpi, item.before, item.after, item.diff, item.changeRate]),
  };

  const criteriaSheet = {
    name: "Criteria",
    header: ["Label", "KPI", "Direction", "Threshold", "Before", "After", "ChangeRate", "Passed"],
    rows: result.criteriaEvaluations.map((item) => [
      item.criterion.label,
      item.criterion.kpi,
      item.criterion.direction,
      item.criterion.threshold,
      item.before,
      item.after,
      item.changeRate,
      item.passed ? "yes" : "no",
    ]),
  };

  const campaignHeader = ["CampaignId", "CampaignName", "IsNew", "IsRemoved"];
  for (const kpi of result.focusKpis) {
    campaignHeader.push(`${kpi}_before`, `${kpi}_after`, `${kpi}_change_rate`);
  }
  const campaignSheet = {
    name: "Campaign_Diff",
    header: campaignHeader,
    rows: result.campaignDiffs.map((item) => {
      const row: Array<string | number> = [
        item.campaignId,
        item.campaignName,
        item.isNew ? "yes" : "no",
        item.isRemoved ? "yes" : "no",
      ];
      for (const kpi of result.focusKpis) {
        const diff = getDiffByKpi(item.focusDiffs, kpi);
        row.push(diff?.before ?? 0, diff?.after ?? 0, diff?.changeRate ?? 0);
      }
      return row;
    }),
  };

  const sheets = [overallSheet, criteriaSheet, campaignSheet];
  if (result.budgetSimulation) {
    sheets.push({
      name: "Budget_Simulation",
      header: [
        "BeforeDailyBudget",
        "AfterDailyBudget",
        "BudgetChangeRate",
        "BeforeRoas",
        "ExpectedDailySales",
        "ActualDailySales",
        "ExpectedVsActualRate",
        "BeforeDays",
        "AfterDays",
      ],
      rows: [
        [
          result.budgetSimulation.beforeTotalDailyBudget,
          result.budgetSimulation.afterTotalDailyBudget,
          result.budgetSimulation.budgetChangeRate,
          result.budgetSimulation.beforeRoas,
          result.budgetSimulation.expectedDailySales,
          result.budgetSimulation.actualDailySales,
          result.budgetSimulation.expectedVsActualRate,
          result.budgetSimulation.beforeDays,
          result.budgetSimulation.afterDays,
        ],
      ],
    });

    sheets.push({
      name: "Campaign_Budget_Diff",
      header: [
        "CampaignId",
        "CampaignName",
        "IsNew",
        "IsRemoved",
        "BeforeDailyBudget",
        "AfterDailyBudget",
        "BudgetChangeRate",
      ],
      rows: result.budgetSimulation.campaignBudgetDiffs.map((item) => [
        item.campaignId,
        item.campaignName,
        item.isNew ? "yes" : "no",
        item.isRemoved ? "yes" : "no",
        item.beforeDailyBudget,
        item.afterDailyBudget,
        item.budgetChangeRate,
      ]),
    });
  }

  if ((result.hypotheses?.length ?? 0) > 0) {
    sheets.push({
      name: "Hypotheses",
      header: ["Id", "Pattern", "Hypothesis", "Confidence", "SuggestedAction", "SuggestedMetrics"],
      rows: (result.hypotheses ?? []).map((item) => [
        item.id,
        item.pattern,
        item.hypothesis,
        item.confidence,
        item.suggestedAction,
        item.suggestedMetrics.join(" / "),
      ]),
    });
  }

  if (result.llmAnalysis) {
    sheets.push({
      name: "LLM_Analysis",
      header: ["Section", "Content"],
      rows: [["analysis", result.llmAnalysis]],
    });
  }

  await writeXlsx(outputPath, sheets);
};

// === measure-log command ===

program
  .command("measure-log")
  .description("Manage measure execution logs")
  .option("--list", "List entries")
  .option("--add", "Add an entry")
  .option("--update <id>", "Update an entry by id")
  .option("--remove <id>", "Remove an entry by id")
  .option("--pattern <id>", "Measure pattern id")
  .option("--name <text>", "Measure name")
  .option("--date <yyyy-mm-dd>", "Measure execution date")
  .option("--description <text>", "Measure description")
  .option("--status <status>", "pending | monitoring | completed | archived")
  .option("--id <entry-id>", "Target entry ID (for --note)")
  .option("--note <text>", "Add a note (standalone: requires --id; with --add: initial note)")
  .option("--from <yyyy-mm-dd>", "Filter: entries on or after this date")
  .option("--to <yyyy-mm-dd>", "Filter: entries on or before this date")
  .option("--format <type>", "console | json | markdown", "console")
  .action(
    async (options: {
      list?: boolean;
      add?: boolean;
      update?: string;
      remove?: string;
      pattern?: string;
      name?: string;
      date?: string;
      description?: string;
      status?: string;
      id?: string;
      note?: string;
      from?: string;
      to?: string;
      format?: string;
    }) => {
      const format = toOutputFormat(options.format, "console");
      const status = toMeasureLogStatus(options.status);
      if (options.status && !status) {
        throw new Error(`Invalid status: ${options.status}. expected pending | monitoring | completed | archived`);
      }

      if (options.note && !options.add && !options.remove) {
        if (!options.id) throw new Error("--id is required with --note");
        const updated = await addNoteToMeasureLog(options.id, options.note);
        if (!updated) throw new Error(`Measure log not found: ${options.id}`);

        if (format === "json") {
          console.log(JSON.stringify(updated, null, 2));
          return;
        }
        logger.info("Note added", {
          id: updated.id,
          name: updated.name,
          notesCount: updated.notes?.length ?? 0,
          latestNote: options.note,
        });
        return;
      }

      if (options.add) {
        if (!options.pattern) throw new Error("--pattern is required with --add");
        if (!options.name) throw new Error("--name is required with --add");
        if (!options.date) throw new Error("--date is required with --add");

        const pattern = await getMeasurePatternById(options.pattern);
        if (!pattern) throw new Error(`Unknown pattern: ${options.pattern}`);

        const entry = await addMeasureLog({
          patternId: options.pattern,
          name: options.name,
          date: options.date,
          description: options.description,
          status,
          note: options.note,
        });

        if (format === "json") {
          console.log(JSON.stringify(entry, null, 2));
          return;
        }
        if (format === "markdown") {
          const table = toMeasureLogMarkdown([entry], new Map([[pattern.id, pattern]]));
          console.log(table);
          return;
        }

        const { reminder } = calcMeasureReminder(entry, pattern);
        logger.info("Measure log added", {
          id: entry.id,
          patternId: entry.patternId,
          name: entry.name,
          date: entry.date,
          status: entry.status,
          reminder,
        });
        return;
      }

      if (options.update) {
        const entry = await updateMeasureLog({
          id: options.update,
          name: options.name,
          date: options.date,
          description: options.description,
          status,
        });

        if (format === "json") {
          console.log(JSON.stringify(entry, null, 2));
          return;
        }

        const pattern = await getMeasurePatternById(entry.patternId);
        const { reminder } = pattern
          ? calcMeasureReminder(entry, pattern)
          : { reminder: "" };
        logger.info("Measure log updated", {
          id: entry.id,
          name: entry.name,
          date: entry.date,
          status: entry.status,
          reminder,
        });
        return;
      }

      if (options.remove) {
        const removed = await removeMeasureLog(options.remove);
        if (!removed) {
          throw new Error(`Measure log not found: ${options.remove}`);
        }
        logger.info("Measure log removed", { id: options.remove });
        return;
      }

      if (options.list || (!options.add && !options.remove && !options.update)) {
        const [entries, patterns] = await Promise.all([
          listMeasureLogs({ status, patternId: options.pattern, from: options.from, to: options.to }),
          loadMeasurePatterns(),
        ]);
        const patternMap = new Map(patterns.map((p) => [p.id, p]));
        const now = new Date();

        if (format === "json") {
          const enriched = entries.map((entry) => {
            const pattern = patternMap.get(entry.patternId);
            const rem = pattern ? calcMeasureReminder(entry, pattern, now) : { daysElapsed: 0, reminder: "" };
            return { ...entry, daysElapsed: rem.daysElapsed, reminder: rem.reminder };
          });
          console.log(JSON.stringify(enriched, null, 2));
          return;
        }
        if (format === "markdown") {
          console.log(toMeasureLogMarkdown(entries, patternMap));
          return;
        }

        console.table(
          entries.map((entry) => {
            const pattern = patternMap.get(entry.patternId);
            const { reminder } = pattern ? calcMeasureReminder(entry, pattern, now) : { reminder: "" };
            return {
              id: entry.id,
              date: entry.date,
              pattern: pattern?.name ?? entry.patternId,
              name: entry.name,
              status: entry.status,
              notes: entry.notes?.length ?? 0,
              reminder,
            };
          }),
        );
      }
    },
  );

// === measure-compare command ===

program
  .command("measure-compare")
  .description("Compare before/after KPI for a measure")
  .option("--pattern <id>", "Measure pattern id")
  .option("--log-id <id>", "Resolve pattern and metadata from measure-log entry")
  .requiredOption("--before <pattern>", "Before input pattern")
  .requiredOption("--after <pattern>", "After input pattern")
  .option("--campaigns <list>", "Comma separated campaign ids or names")
  .option("--asins <list>", "Comma separated ASINs")
  .option("--name <text>", "Measure name (for custom)")
  .option("--description <text>", "Measure description")
  .option("--with-llm", "Run LLM analysis (mainly for custom pattern)")
  .option("--output <file>", "Output file path")
  .option("--format <type>", "console | json | markdown | xlsx", "console")
  .action(
    async (options: {
      pattern?: string;
      logId?: string;
      before: string;
      after: string;
      campaigns?: string;
      asins?: string;
      name?: string;
      description?: string;
      withLlm?: boolean;
      output?: string;
      format?: string;
    }) => {
      const logEntry = options.logId ? await getMeasureLogById(options.logId) : undefined;
      if (options.logId && !logEntry) {
        throw new Error(`Measure log not found: ${options.logId}`);
      }

      const patternId = options.pattern ?? logEntry?.patternId;
      if (!patternId) {
        throw new Error("Pattern is required. specify --pattern or --log-id");
      }
      const pattern = await getMeasurePatternById(patternId);
      if (!pattern) {
        throw new Error(`Unknown pattern: ${patternId}`);
      }

      const config = loadOptimisationConfig();
      const [beforeResult, afterResult] = await Promise.all([
        runAnalyzePipeline(options.before, config),
        runAnalyzePipeline(options.after, config),
      ]);

      const compareResultBase = compareMeasureEffect({
        before: beforeResult,
        after: afterResult,
        beforeInput: options.before,
        afterInput: options.after,
        pattern,
        filters: {
          campaigns: parseCsvList(options.campaigns),
          asins: parseCsvList(options.asins),
        },
        logEntry,
        measureName: options.name,
        measureDescription: options.description,
      });

      let compareResult = compareResultBase;
      if (options.withLlm) {
        const llm = await runMeasureLlmAnalysis(compareResult, options.description ?? logEntry?.description);
        if (llm) {
          compareResult = {
            ...compareResult,
            llmAnalysis: llm,
          };
        }
      }

      if (options.logId) {
        await saveMeasureCompareToLog(options.logId, compareResult);
      }

      const format = toOutputFormat(options.format, "console");
      const outputPath =
        options.output ??
        (format === "xlsx" ? path.resolve("output", `measure-compare-${timestampForFilename()}.xlsx`) : undefined);

      if (format === "json") {
        const content = JSON.stringify(compareResult, null, 2);
        if (outputPath) {
          await writeTextFile(outputPath, content);
          logger.info("Measure compare JSON saved", { output: outputPath });
        } else {
          console.log(content);
        }
        return;
      }

      if (format === "markdown") {
        const content = toMeasureCompareMarkdown(compareResult);
        if (outputPath) {
          await writeTextFile(outputPath, content);
          logger.info("Measure compare markdown saved", { output: outputPath });
        } else {
          console.log(content);
        }
        return;
      }

      if (format === "xlsx" || (outputPath && outputPath.toLowerCase().endsWith(".xlsx"))) {
        const target = outputPath ?? path.resolve("output", `measure-compare-${timestampForFilename()}.xlsx`);
        await writeMeasureCompareXlsx(target, compareResult);
        logger.info("Measure compare xlsx generated", { output: target });
        return;
      }

      printMeasureCompareConsole(compareResult);
    },
  );

// === measure-report command ===

program
  .command("measure-report")
  .description("Generate measure report from saved compare result")
  .option("--log-id <id>", "Measure log id")
  .option("--output <file>", "Output file path")
  .option("--format <type>", "console | json | markdown | xlsx", "markdown")
  .action(async (options: { logId?: string; output?: string; format?: string }) => {
    let targetLog: MeasureLogEntry | undefined;
    if (options.logId) {
      targetLog = await getMeasureLogById(options.logId);
    } else {
      const entries = await listMeasureLogs();
      targetLog = entries.find((entry) => entry.lastCompare);
    }

    if (!targetLog) {
      throw new Error("No measure log found. specify --log-id or run measure-compare with --log-id first");
    }
    if (!targetLog.lastCompare) {
      throw new Error(`No compare result saved for log: ${targetLog.id}`);
    }

    const compareResult = targetLog.lastCompare;
    const format = toOutputFormat(options.format, "markdown");
    const outputPath =
      options.output ??
      (format === "xlsx" ? path.resolve("output", `measure-report-${timestampForFilename()}.xlsx`) : undefined);

    if (format === "json") {
      const content = JSON.stringify(compareResult, null, 2);
      if (outputPath) {
        await writeTextFile(outputPath, content);
        logger.info("Measure report JSON saved", { output: outputPath });
      } else {
        console.log(content);
      }
      return;
    }

    if (format === "markdown") {
      const content = toMeasureCompareMarkdown(compareResult);
      if (outputPath) {
        await writeTextFile(outputPath, content);
        logger.info("Measure report markdown saved", { output: outputPath });
      } else {
        console.log(content);
      }
      return;
    }

    if (format === "xlsx" || (outputPath && outputPath.toLowerCase().endsWith(".xlsx"))) {
      const target = outputPath ?? path.resolve("output", `measure-report-${timestampForFilename()}.xlsx`);
      await writeMeasureCompareXlsx(target, compareResult);
      logger.info("Measure report xlsx generated", { output: target });
      return;
    }

    printMeasureCompareConsole(compareResult);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logger.error("Command failed", { error: message });
  process.exitCode = 1;
});
