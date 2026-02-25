// Campaign template configuration types and defaults

export interface CampaignTypeAuto {
  enabled: boolean;
  dailyBudget: number;
  defaultBid: number;
  biddingStrategy?: string;
  topOfSearchPercentage?: number;
  productPagesPercentage?: number;
  skus?: string[];
}

export interface KeywordEntry {
  text: string;
  bid?: number;
}

export interface CampaignTypeKeyword {
  enabled: boolean;
  dailyBudget: number;
  defaultBid: number;
  keywords: KeywordEntry[];
  biddingStrategy?: string;
  topOfSearchPercentage?: number;
  productPagesPercentage?: number;
  skus?: string[];
}

export interface ProductTargetEntry {
  asin: string;
  bid?: number;
}

export interface CampaignTypeAsin {
  enabled: boolean;
  dailyBudget: number;
  defaultBid: number;
  targets: ProductTargetEntry[];
  biddingStrategy?: string;
  topOfSearchPercentage?: number;
  productPagesPercentage?: number;
  skus?: string[];
}

export interface ManualAdGroupConfig {
  name: string;
  defaultBid: number;
  keywords?: KeywordEntry[];
  productTargets?: ProductTargetEntry[];
  skus?: string[];
}

export interface ManualCampaignConfig {
  name: string;
  dailyBudget: number;
  targetingType: "manual" | "auto";
  biddingStrategy?: string;
  topOfSearchPercentage?: number;
  productPagesPercentage?: number;
  adGroups: ManualAdGroupConfig[];
  negativeKeywords?: string[];
  skus?: string[];
}

export interface NamingConvention {
  campaignTemplate?: string;
  adGroupTemplate?: string;
  typeLabels?: Record<string, string>;
  adGroupDescriptors?: Record<string, string>;
}

export interface CampaignTemplateConfig {
  brandName: string;
  brandCode: string;
  dateSuffix: string;
  portfolioId?: string;
  skus: string[];
  campaigns: {
    auto?: CampaignTypeAuto;
    phrase?: CampaignTypeKeyword;
    broad?: CampaignTypeKeyword;
    asin?: CampaignTypeAsin;
    manual?: ManualCampaignConfig[];
  };
  negativeKeywords?: string[];
  biddingStrategy?: string;
  naming?: NamingConvention;
}

export const CAMPAIGN_TEMPLATE_DEFAULTS = {
  biddingStrategy: "Dynamic bids - down only",
  dailyBudget: 1000,
  defaultBid: 50,
} as const;

export const AD_GROUP_DESCRIPTORS: Record<string, string> = {
  auto: "auto",
  phrase: "phrase",
  broad: "broad",
  asin: "asin",
};

export const DEFAULT_TYPE_LABELS: Record<string, string> = {
  auto: "auto",
  phrase: "phrase",
  broad: "broad",
  asin: "asin",
};

export const formatCampaignName = (
  config: CampaignTemplateConfig,
  typeKey: string,
): string => {
  const template = config.naming?.campaignTemplate ?? "{brand}_{typeLabel}_{suffix}";
  const typeLabels = { ...DEFAULT_TYPE_LABELS, ...config.naming?.typeLabels };
  const typeLabel = typeLabels[typeKey] ?? typeKey;

  return template
    .replace("{brand}", config.brandName)
    .replace("{code}", config.brandCode)
    .replace("{typeLabel}", typeLabel)
    .replace("{suffix}", config.dateSuffix);
};

export const formatAdGroupName = (
  config: CampaignTemplateConfig,
  typeKey: string,
): string => {
  const template = config.naming?.adGroupTemplate ?? "{code}_{descriptor}";
  const descriptors = { ...AD_GROUP_DESCRIPTORS, ...config.naming?.adGroupDescriptors };
  const descriptor = descriptors[typeKey] ?? typeKey;

  return template
    .replace("{brand}", config.brandName)
    .replace("{code}", config.brandCode)
    .replace("{descriptor}", descriptor);
};

export const computeFallbackDefaultBid = (config: CampaignTemplateConfig): number => {
  const bids: number[] = [];
  if (config.campaigns.auto?.defaultBid) bids.push(config.campaigns.auto.defaultBid);
  if (config.campaigns.phrase?.defaultBid) bids.push(config.campaigns.phrase.defaultBid);
  if (config.campaigns.broad?.defaultBid) bids.push(config.campaigns.broad.defaultBid);
  if (config.campaigns.asin?.defaultBid) bids.push(config.campaigns.asin.defaultBid);
  if (bids.length > 0) {
    return Math.round(bids.reduce((a, b) => a + b, 0) / bids.length);
  }
  return CAMPAIGN_TEMPLATE_DEFAULTS.defaultBid;
};

export const validateCampaignTemplateConfig = (
  config: unknown,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config must be an object"] };
  }

  const c = config as Record<string, unknown>;

  if (!c.brandName || typeof c.brandName !== "string" || c.brandName.trim() === "") {
    errors.push("brandName is required and must be a non-empty string");
  }
  if (!c.brandCode || typeof c.brandCode !== "string" || c.brandCode.trim() === "") {
    errors.push("brandCode is required and must be a non-empty string");
  }
  if (!c.dateSuffix || typeof c.dateSuffix !== "string" || c.dateSuffix.trim() === "") {
    errors.push("dateSuffix is required and must be a non-empty string");
  }
  if (!Array.isArray(c.skus) || c.skus.length === 0) {
    errors.push("skus must be a non-empty array");
  }
  if (!c.campaigns || typeof c.campaigns !== "object") {
    errors.push("campaigns is required and must be an object");
  } else {
    const campaigns = c.campaigns as Record<string, unknown>;
    const hasEnabled =
      (campaigns.auto as Record<string, unknown>)?.enabled ||
      (campaigns.phrase as Record<string, unknown>)?.enabled ||
      (campaigns.broad as Record<string, unknown>)?.enabled ||
      (campaigns.asin as Record<string, unknown>)?.enabled ||
      (Array.isArray(campaigns.manual) && campaigns.manual.length > 0);
    if (!hasEnabled) {
      errors.push("At least one campaign type must be enabled or manual campaigns defined");
    }
  }

  return { valid: errors.length === 0, errors };
};
