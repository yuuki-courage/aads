export const HEADER_CANDIDATES = {
  campaignId: ["Campaign ID", "キャンペーンID", "campaign_id"],
  campaignName: ["Campaign Name", "キャンペーン名", "キャンペーン名（情報提供のみ）", "campaign_name"],
  adGroupId: ["Ad Group ID", "広告グループID", "ad_group_id"],
  adGroupName: ["Ad Group Name", "広告グループ名", "広告グループ名（情報提供のみ）", "ad_group_name"],
  keywordId: ["Keyword ID", "キーワードID", "keyword_id"],
  keywordText: ["Keyword Text", "キーワードテキスト", "Search Term", "search_term"],
  customerSearchTerm: ["カスタマー検索用語", "Customer Search Term", "customer_search_term"],
  productTargetingExpression: ["Product Targeting Expression", "Targeting Expression", "商品ターゲティング式"],
  matchType: ["Match Type", "マッチタイプ", "match_type"],
  clicks: ["Clicks", "クリック数", "clicks"],
  impressions: ["Impressions", "インプレッション数", "impressions"],
  spend: ["Spend", "支出", "spend"],
  sales: ["Sales", "売上", "sales"],
  orders: ["Orders", "注文", "注文数", "orders"],
  sku: ["SKU", "sku"],
  asin: ["ASIN", "ASIN（情報提供のみ）", "asin"],
  dailyBudget: ["Daily Budget", "Campaign Daily Budget", "New_Daily_Budget", "日次予算", "campaign_daily_budget"],
  bid: ["Bid", "入札額", "bid"],
  adGroupDefaultBid: ["Ad Group Default Bid", "ad_group_default_bid"],
  state: ["State", "state", "キャンペーンのステータス", "status"],
  targetingType: ["Targeting Type", "ターゲティングの種類", "Campaign Targeting Type", "targeting_type"],
  portfolioId: ["Portfolio ID", "ポートフォリオID", "portfolio_id"],
  placement: ["Placement", "Placement Type", "掲載枠", "placement"],
} as const;

export const STATE_MAPPING_JP_TO_EN: Record<string, "enabled" | "paused" | "archived"> = {
  有効: "enabled",
  一時停止: "paused",
  非掲載: "archived",
  enabled: "enabled",
  paused: "paused",
  archived: "archived",
};

export const OPTIMIZATION_DEFAULTS = {
  targetAcos: 0.25,
  minClicksForCpc: 5,
  minClicksForPromotion: 5,
  minCvrForPromotion: 0.03,
  negativeAcosThreshold: 0.4,
  b190: {
    impressionThreshold: 0.5,
    spendThreshold: 0.5,
    cpcThreshold: 0.3,
  },
  sale: {
    enabled: false,
    cpcReductionFactor: 0.33,
    defaultCpc: 30,
  },
  seo: {
    enabled: true,
    cpcCeiling: 0, // 0 = auto (2x avg CPC); >0 = fixed ceiling
    factors: { 1: 0.5, 2: 0.6, 3: 0.7, 4: 0.8 } as Record<number, number>,
  },
} as const;

export const BULK_SCHEMA_HEADER_V210 = [
  "Product",
  "Entity",
  "Operation",
  "Campaign Name",
  "Campaign ID",
  "Portfolio ID",
  "Ad Group Name",
  "Ad Group ID",
  "Ad Group Default Bid",
  "SKU / ASIN",
  "Keyword Text",
  "Product Targeting Expression",
  "Match Type",
  "Campaign Targeting Type",
  "State",
  "Daily Budget",
  "Bid",
  "Start Date",
  "End Date",
  "Bidding Strategy",
  "Placement (Top of Search)",
  "Percentage",
  "Placement (Product Pages)",
  "Targeting Type",
  "Keyword ID",
  "Product Targeting ID",
  "Campaign Status",
] as const;

export const SKU_LABEL_RULES = {
  focus: { maxAcos: 0.15, minCvr: 0.05, bidAdjust: 1.2, budgetAdjust: 1.15 },
  nurture: { maxAcos: 0.25, minCvr: 0.03, bidAdjust: 1.05, budgetAdjust: 1.0 },
  improve: { maxAcos: Number.POSITIVE_INFINITY, minCvr: 0, bidAdjust: 1.0, budgetAdjust: 1.0 },
  prune: { minAcos: 0.35, maxCvr: 0.015, bidAdjust: 0.8, budgetAdjust: 0.85 },
} as const;
