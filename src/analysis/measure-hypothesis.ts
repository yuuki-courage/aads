import type {
  MeasureBudgetSimulation,
  MeasureCampaignDiff,
  MeasureHypothesis,
  MeasureKpiDiff,
  MeasureKpiKey,
} from "../pipeline/types.js";

export interface GenerateHypothesesInput {
  overallDiffs: MeasureKpiDiff[];
  focusDiffs: MeasureKpiDiff[];
  budgetSimulation?: MeasureBudgetSimulation;
  campaignDiffs: MeasureCampaignDiff[];
}

type HypothesisRule = (input: GenerateHypothesesInput) => MeasureHypothesis | undefined;

const getDiff = (input: GenerateHypothesesInput, kpi: MeasureKpiKey): MeasureKpiDiff | undefined => {
  return input.overallDiffs.find((item) => item.kpi === kpi) ?? input.focusDiffs.find((item) => item.kpi === kpi);
};

const ruleAcosUpSalesFlat: HypothesisRule = (input) => {
  const acos = getDiff(input, "acos");
  const sales = getDiff(input, "sales");
  if (!acos || !sales) return undefined;
  if (acos.changeRate < 0.05) return undefined;
  if (Math.abs(sales.changeRate) >= 0.05) return undefined;
  return {
    id: "acos-up-sales-flat",
    pattern: "ACOSが上昇し、売上は横ばい",
    hypothesis: "Auto/Manual間のカニバリ、または非効率トラフィック比率上昇の可能性",
    confidence: "high",
    suggestedAction: "検索語句の重複配信とキャンペーン競合を確認し、除外設定と入札を整理する",
    suggestedMetrics: ["検索語句重複率", "キャンペーン別増分売上", "MatchType別ACOS"],
  };
};

const ruleCtrDown: HypothesisRule = (input) => {
  const ctr = getDiff(input, "ctr");
  if (!ctr) return undefined;
  if (ctr.changeRate > -0.05) return undefined;
  return {
    id: "ctr-down",
    pattern: "CTRが5%以上低下",
    hypothesis: "キーワード関連性低下、または競合増加で広告訴求が弱まっている可能性",
    confidence: "medium",
    suggestedAction: "検索語句上位帯の訴求軸と競合表示内容を確認し、訴求文脈を更新する",
    suggestedMetrics: ["検索語句別CTR", "TopOfSearch比率", "競合ASIN数"],
  };
};

const ruleCvrDown: HypothesisRule = (input) => {
  const cvr = getDiff(input, "cvr");
  if (!cvr) return undefined;
  if (cvr.changeRate > -0.05) return undefined;
  return {
    id: "cvr-down",
    pattern: "CVRが5%以上低下",
    hypothesis: "流入トラフィックの質が悪化し、購入意図が弱い層に配信が偏った可能性",
    confidence: "medium",
    suggestedAction: "検索語句と商品詳細ページの整合性を確認し、意図ズレの配信を抑制する",
    suggestedMetrics: ["検索語句別CVR", "商品詳細ページ遷移後CVR", "新規流入比率"],
  };
};

const ruleCpcDisproportionate: HypothesisRule = (input) => {
  const cpc = getDiff(input, "cpc");
  const sales = getDiff(input, "sales");
  if (!cpc || !sales) return undefined;
  if (cpc.changeRate < 0.1) return undefined;
  if (sales.changeRate >= cpc.changeRate / 2) return undefined;
  return {
    id: "cpc-disproportionate",
    pattern: "CPC上昇に売上成長が追随していない",
    hypothesis: "入札過剰、または競争激化でクリック単価だけが先行上昇している可能性",
    confidence: "high",
    suggestedAction: "入札上限とPlacement調整係数を再点検し、高CPCクエリを絞り込む",
    suggestedMetrics: ["Placement別CPC", "入札単価分布", "クエリ別ROAS"],
  };
};

const ruleScaleVsEfficiency: HypothesisRule = (input) => {
  const sales = getDiff(input, "sales");
  const roas = getDiff(input, "roas");
  if (!sales || !roas) return undefined;
  if (sales.changeRate < 0.1) return undefined;
  if (roas.changeRate > -0.05) return undefined;
  return {
    id: "scale-vs-efficiency",
    pattern: "売上は伸びたがROASが低下",
    hypothesis: "規模拡大と効率低下のトレードオフが発生している可能性",
    confidence: "medium",
    suggestedAction: "増分売上を維持しつつ低効率クエリを段階的に抑制し、収益性を再調整する",
    suggestedMetrics: ["売上増分寄与", "クエリ別ROAS", "キャンペーン別利益率"],
  };
};

const ruleBudgetUpSalesBelowExpected: HypothesisRule = (input) => {
  const simulation = input.budgetSimulation;
  if (!simulation) return undefined;
  if (simulation.budgetChangeRate <= 0) return undefined;
  if (simulation.actualDailySales >= simulation.expectedDailySales * 0.9) return undefined;
  return {
    id: "budget-up-sales-below-expected",
    pattern: "予算増加に対して実売上が期待値を下回る",
    hypothesis: "予算未消化、または効率低下でROAS維持前提の期待売上に届いていない可能性",
    confidence: "high",
    suggestedAction: "予算消化率と配信制約を確認し、未消化要因と効率悪化要因を分離して対処する",
    suggestedMetrics: ["日別予算消化率", "LostIS(Budget)", "時間帯別CVR", "時間帯別CPC"],
  };
};

const ruleNewCampaignLowContribution: HypothesisRule = (input) => {
  const newCampaigns = input.campaignDiffs.filter((campaign) => campaign.isNew);
  if (newCampaigns.length === 0) return undefined;

  const totalAfterSales = input.campaignDiffs.reduce((sum, campaign) => sum + campaign.after.sales, 0);
  if (totalAfterSales <= 0) return undefined;
  const newCampaignSales = newCampaigns.reduce((sum, campaign) => sum + campaign.after.sales, 0);
  if (newCampaignSales / totalAfterSales >= 0.1) return undefined;

  return {
    id: "new-campaign-low-contribution",
    pattern: "新規キャンペーンの売上寄与が全体10%未満",
    hypothesis: "立ち上げ初期で学習不足、または配信量不足の可能性",
    confidence: "low",
    suggestedAction: "新規キャンペーンの露出量とクエリ獲得状況を確認し、初期学習を優先して調整する",
    suggestedMetrics: ["新規キャンペーンのImpressionShare", "新規キャンペーンのCTR/CVR", "検索語句獲得数"],
  };
};

const RULES: HypothesisRule[] = [
  ruleAcosUpSalesFlat,
  ruleCtrDown,
  ruleCvrDown,
  ruleCpcDisproportionate,
  ruleScaleVsEfficiency,
  ruleBudgetUpSalesBelowExpected,
  ruleNewCampaignLowContribution,
];

export const generateHypotheses = (input: GenerateHypothesesInput): MeasureHypothesis[] => {
  return RULES.map((rule) => rule(input)).filter((hypothesis): hypothesis is MeasureHypothesis => !!hypothesis);
};
