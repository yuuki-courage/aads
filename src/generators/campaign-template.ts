import { buildBulkRow } from "./row-builders.js";
import { normalizeMatchType } from "../core/normalizer.js";
import { generateCpcRows } from "./block2-cpc.js";
import {
  CAMPAIGN_TEMPLATE_DEFAULTS,
  formatCampaignName,
  formatAdGroupName,
  computeFallbackDefaultBid,
} from "../config/campaign-template-defaults.js";
import type {
  CampaignTemplateConfig,
  CampaignTypeAuto,
  CampaignTypeKeyword,
  CampaignTypeAsin,
  ManualCampaignConfig,
} from "../config/campaign-template-defaults.js";
import type {
  BulkOutputRow,
  AnalyzePipelineResult,
  CpcRecommendation,
  NormalizedRecord,
} from "../pipeline/types.js";

export interface CampaignTemplateUpdateContext {
  analyzeResult: AnalyzePipelineResult;
}

// ── Create Mode helpers ──

const createCampaignRow = (
  name: string,
  config: CampaignTemplateConfig,
  opts: {
    dailyBudget: number;
    targetingType: "manual" | "auto";
    biddingStrategy?: string;
    topOfSearchPercentage?: number;
    productPagesPercentage?: number;
  },
): BulkOutputRow => {
  const row = buildBulkRow({
    Entity: "Campaign",
    Operation: "create",
    "Campaign Name": name,
    "Campaign ID": name, // Temporary linkage
    "Portfolio ID": config.portfolioId ?? "",
    "Campaign Targeting Type": opts.targetingType,
    State: "enabled",
    "Daily Budget": opts.dailyBudget,
    "Bidding Strategy":
      opts.biddingStrategy ?? config.biddingStrategy ?? CAMPAIGN_TEMPLATE_DEFAULTS.biddingStrategy,
  });

  if (opts.topOfSearchPercentage != null && opts.topOfSearchPercentage > 0) {
    row["Placement (Top of Search)"] = String(opts.topOfSearchPercentage);
  }
  if (opts.productPagesPercentage != null && opts.productPagesPercentage > 0) {
    row["Placement (Product Pages)"] = String(opts.productPagesPercentage);
  }

  return row;
};

const createAdGroupRow = (
  campaignName: string,
  adGroupName: string,
  defaultBid: number,
): BulkOutputRow =>
  buildBulkRow({
    Entity: "Ad Group",
    Operation: "create",
    "Campaign Name": campaignName,
    "Campaign ID": campaignName,
    "Ad Group Name": adGroupName,
    "Ad Group ID": adGroupName,
    "Ad Group Default Bid": defaultBid,
    State: "enabled",
  });

const createProductAdRows = (
  campaignName: string,
  adGroupName: string,
  skus: string[],
): BulkOutputRow[] =>
  skus.map((sku) =>
    buildBulkRow({
      Entity: "Product Ad",
      Operation: "create",
      "Campaign Name": campaignName,
      "Campaign ID": campaignName,
      "Ad Group Name": adGroupName,
      "Ad Group ID": adGroupName,
      "SKU / ASIN": sku,
      State: "enabled",
    }),
  );

const createKeywordRows = (
  campaignName: string,
  adGroupName: string,
  keywords: { text: string; bid?: number }[],
  matchType: string,
  fallbackBid: number,
): BulkOutputRow[] =>
  keywords.map((kw) =>
    buildBulkRow({
      Entity: "Keyword",
      Operation: "create",
      "Campaign Name": campaignName,
      "Campaign ID": campaignName,
      "Ad Group Name": adGroupName,
      "Ad Group ID": adGroupName,
      "Keyword Text": kw.text,
      "Match Type": normalizeMatchType(matchType),
      Bid: kw.bid ?? fallbackBid,
      State: "enabled",
    }),
  );

const createNegativeKeywordRows = (
  campaignName: string,
  keywords: string[],
): BulkOutputRow[] =>
  keywords.map((kw) =>
    buildBulkRow({
      Entity: "Campaign Negative Keyword",
      Operation: "create",
      "Campaign Name": campaignName,
      "Campaign ID": campaignName,
      "Keyword Text": kw,
      "Match Type": "negative exact",
      State: "enabled",
    }),
  );

const createProductTargetingRows = (
  campaignName: string,
  adGroupName: string,
  targets: { asin: string; bid?: number }[],
  fallbackBid: number,
): BulkOutputRow[] =>
  targets.map((t) =>
    buildBulkRow({
      Entity: "Product Targeting",
      Operation: "create",
      "Campaign Name": campaignName,
      "Campaign ID": campaignName,
      "Ad Group Name": adGroupName,
      "Ad Group ID": adGroupName,
      "Product Targeting Expression": `asin="${t.asin}"`,
      Bid: t.bid ?? fallbackBid,
      State: "enabled",
    }),
  );

const resolveSkus = (
  perCampaignSkus: string[] | undefined,
  globalSkus: string[],
): string[] => perCampaignSkus && perCampaignSkus.length > 0 ? perCampaignSkus : globalSkus;

// ── Create Mode ──

const generateAutoRows = (
  config: CampaignTemplateConfig,
  auto: CampaignTypeAuto,
): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];
  const campaignName = formatCampaignName(config, "auto");
  const adGroupName = formatAdGroupName(config, "auto");
  const skus = resolveSkus(auto.skus, config.skus);

  rows.push(
    createCampaignRow(campaignName, config, {
      dailyBudget: auto.dailyBudget,
      targetingType: "auto",
      biddingStrategy: auto.biddingStrategy,
      topOfSearchPercentage: auto.topOfSearchPercentage,
      productPagesPercentage: auto.productPagesPercentage,
    }),
  );
  rows.push(createAdGroupRow(campaignName, adGroupName, auto.defaultBid));
  rows.push(...createProductAdRows(campaignName, adGroupName, skus));

  if (config.negativeKeywords && config.negativeKeywords.length > 0) {
    rows.push(...createNegativeKeywordRows(campaignName, config.negativeKeywords));
  }

  return rows;
};

const generateKeywordTypeRows = (
  config: CampaignTemplateConfig,
  typeKey: "phrase" | "broad",
  typeConfig: CampaignTypeKeyword,
): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];
  const campaignName = formatCampaignName(config, typeKey);
  const adGroupName = formatAdGroupName(config, typeKey);
  const skus = resolveSkus(typeConfig.skus, config.skus);

  rows.push(
    createCampaignRow(campaignName, config, {
      dailyBudget: typeConfig.dailyBudget,
      targetingType: "manual",
      biddingStrategy: typeConfig.biddingStrategy,
      topOfSearchPercentage: typeConfig.topOfSearchPercentage,
      productPagesPercentage: typeConfig.productPagesPercentage,
    }),
  );
  rows.push(createAdGroupRow(campaignName, adGroupName, typeConfig.defaultBid));
  rows.push(...createProductAdRows(campaignName, adGroupName, skus));
  rows.push(
    ...createKeywordRows(campaignName, adGroupName, typeConfig.keywords, typeKey, typeConfig.defaultBid),
  );

  if (config.negativeKeywords && config.negativeKeywords.length > 0) {
    rows.push(...createNegativeKeywordRows(campaignName, config.negativeKeywords));
  }

  return rows;
};

const generateAsinRows = (
  config: CampaignTemplateConfig,
  asinConfig: CampaignTypeAsin,
): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];
  const campaignName = formatCampaignName(config, "asin");
  const adGroupName = formatAdGroupName(config, "asin");
  const skus = resolveSkus(asinConfig.skus, config.skus);

  rows.push(
    createCampaignRow(campaignName, config, {
      dailyBudget: asinConfig.dailyBudget,
      targetingType: "manual",
      biddingStrategy: asinConfig.biddingStrategy,
      topOfSearchPercentage: asinConfig.topOfSearchPercentage,
      productPagesPercentage: asinConfig.productPagesPercentage,
    }),
  );
  rows.push(createAdGroupRow(campaignName, adGroupName, asinConfig.defaultBid));
  rows.push(...createProductAdRows(campaignName, adGroupName, skus));
  rows.push(
    ...createProductTargetingRows(campaignName, adGroupName, asinConfig.targets, asinConfig.defaultBid),
  );

  if (config.negativeKeywords && config.negativeKeywords.length > 0) {
    rows.push(...createNegativeKeywordRows(campaignName, config.negativeKeywords));
  }

  return rows;
};

const generateManualCampaignRows = (
  config: CampaignTemplateConfig,
  manual: ManualCampaignConfig,
): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];
  const campaignName = manual.name;
  const globalSkus = config.skus;
  const fallbackBid = computeFallbackDefaultBid(config);

  rows.push(
    createCampaignRow(campaignName, config, {
      dailyBudget: manual.dailyBudget,
      targetingType: manual.targetingType,
      biddingStrategy: manual.biddingStrategy,
      topOfSearchPercentage: manual.topOfSearchPercentage,
      productPagesPercentage: manual.productPagesPercentage,
    }),
  );

  for (const ag of manual.adGroups) {
    const skus = resolveSkus(ag.skus ?? manual.skus, globalSkus);
    rows.push(createAdGroupRow(campaignName, ag.name, ag.defaultBid));
    rows.push(...createProductAdRows(campaignName, ag.name, skus));

    if (ag.keywords && ag.keywords.length > 0) {
      rows.push(
        ...createKeywordRows(campaignName, ag.name, ag.keywords, "exact", ag.defaultBid),
      );
    }
    if (ag.productTargets && ag.productTargets.length > 0) {
      rows.push(
        ...createProductTargetingRows(campaignName, ag.name, ag.productTargets, ag.defaultBid),
      );
    }
  }

  if (manual.negativeKeywords && manual.negativeKeywords.length > 0) {
    rows.push(...createNegativeKeywordRows(campaignName, manual.negativeKeywords));
  }

  return rows;
};

const generateCreateRows = (config: CampaignTemplateConfig): BulkOutputRow[] => {
  const rows: BulkOutputRow[] = [];

  if (config.campaigns.auto?.enabled) {
    rows.push(...generateAutoRows(config, config.campaigns.auto));
  }
  if (config.campaigns.phrase?.enabled) {
    rows.push(...generateKeywordTypeRows(config, "phrase", config.campaigns.phrase));
  }
  if (config.campaigns.broad?.enabled) {
    rows.push(...generateKeywordTypeRows(config, "broad", config.campaigns.broad));
  }
  if (config.campaigns.asin?.enabled) {
    rows.push(...generateAsinRows(config, config.campaigns.asin));
  }
  if (config.campaigns.manual) {
    for (const manual of config.campaigns.manual) {
      rows.push(...generateManualCampaignRows(config, manual));
    }
  }

  return rows;
};

// ── Update Mode ──

const generateUpdateRows = (
  config: CampaignTemplateConfig,
  ctx: CampaignTemplateUpdateContext,
): { rows: BulkOutputRow[]; warnings: string[] } => {
  const rows: BulkOutputRow[] = [];
  const warnings: string[] = [];
  const { records, cpcRecommendations } = ctx.analyzeResult;

  // Build campaign/adGroup ID lookup from SC data
  const campaignMap = new Map<string, { id: string; name: string }>();
  const adGroupMap = new Map<string, { id: string; name: string; campaignName: string }>();

  for (const rec of records) {
    if (rec.campaignId && rec.campaignName) {
      campaignMap.set(rec.campaignName, { id: rec.campaignId, name: rec.campaignName });
    }
    if (rec.adGroupId && rec.adGroupName && rec.campaignName) {
      const key = `${rec.campaignName}|${rec.adGroupName}`;
      adGroupMap.set(key, {
        id: rec.adGroupId,
        name: rec.adGroupName,
        campaignName: rec.campaignName,
      });
    }
  }

  // Use Block 2 CPC rows for keyword bid updates
  if (cpcRecommendations.length > 0) {
    rows.push(...generateCpcRows(cpcRecommendations));
  }

  // Update product targeting bids if asin config exists
  if (config.campaigns.asin?.enabled && config.campaigns.asin.targets.length > 0) {
    const campaignName = formatCampaignName(config, "asin");
    const adGroupName = formatAdGroupName(config, "asin");
    const campaign = campaignMap.get(campaignName);
    const agKey = `${campaignName}|${adGroupName}`;
    const adGroup = adGroupMap.get(agKey);

    if (!campaign) {
      warnings.push(`Campaign not found in SC data: ${campaignName}`);
    }

    for (const target of config.campaigns.asin.targets) {
      const expr = `asin="${target.asin}"`;
      const matchingRecord = records.find(
        (r) =>
          r.campaignName === campaignName &&
          r.adGroupName === adGroupName &&
          r.productTargetingExpression === expr,
      );

      if (matchingRecord) {
        rows.push(
          buildBulkRow({
            Entity: "Product Targeting",
            Operation: "update",
            "Campaign Name": campaignName,
            "Campaign ID": campaign?.id ?? "",
            "Ad Group Name": adGroupName,
            "Ad Group ID": adGroup?.id ?? "",
            "Product Targeting Expression": expr,
            Bid: target.bid ?? config.campaigns.asin.defaultBid,
            State: "enabled",
          }),
        );
      } else {
        warnings.push(`Product targeting not found in SC data: ${expr} in ${campaignName}/${adGroupName}`);
      }
    }
  }

  return { rows, warnings };
};

// ── Main entry ──

export const generateCampaignTemplate = (
  config: CampaignTemplateConfig,
  mode: "create" | "update",
  updateCtx?: CampaignTemplateUpdateContext,
): { rows: BulkOutputRow[]; warnings: string[] } => {
  if (mode === "create") {
    return { rows: generateCreateRows(config), warnings: [] };
  }

  if (!updateCtx) {
    throw new Error("Update mode requires analyzeResult context (--input flag)");
  }

  return generateUpdateRows(config, updateCtx);
};
