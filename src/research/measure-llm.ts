import type { MeasureCompareResult } from "../pipeline/types.js";

const dynamicImport = (moduleName: string): Promise<Record<string, unknown>> =>
  import(moduleName) as Promise<Record<string, unknown>>;

const getApiKey = (): string | undefined => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim() === "") return undefined;
  return key.trim();
};

export const buildMeasureAnalysisPrompt = (
  result: MeasureCompareResult,
  measureDescription?: string,
): string => {
  const compact = {
    generatedAt: result.generatedAt,
    pattern: {
      id: result.patternId,
      name: result.patternName,
      focusKpis: result.focusKpis,
    },
    measureName: result.measureName ?? "",
    measureDescription: measureDescription ?? result.measureDescription ?? "",
    verdict: result.verdict,
    focusDiffs: result.focusDiffs.map((item) => ({
      kpi: item.kpi,
      before: item.before,
      after: item.after,
      changeRate: item.changeRate,
    })),
    criteriaEvaluations: result.criteriaEvaluations.map((item) => ({
      label: item.criterion.label,
      kpi: item.criterion.kpi,
      direction: item.criterion.direction,
      threshold: item.criterion.threshold,
      changeRate: item.changeRate,
      passed: item.passed,
    })),
    topCampaignDiffs: result.campaignDiffs.slice(0, 10).map((item) => ({
      campaignId: item.campaignId,
      campaignName: item.campaignName,
      isNew: item.isNew,
      isRemoved: item.isRemoved,
      salesBefore: item.before.sales,
      salesAfter: item.after.sales,
      acosBefore: item.before.acos,
      acosAfter: item.after.acos,
      cvrBefore: item.before.cvr,
      cvrAfter: item.after.cvr,
    })),
    budgetSimulation: result.budgetSimulation
      ? {
          beforeDailyBudget: result.budgetSimulation.beforeTotalDailyBudget,
          afterDailyBudget: result.budgetSimulation.afterTotalDailyBudget,
          budgetChangeRate: result.budgetSimulation.budgetChangeRate,
          beforeRoas: result.budgetSimulation.beforeRoas,
          expectedDailySales: result.budgetSimulation.expectedDailySales,
          actualDailySales: result.budgetSimulation.actualDailySales,
          expectedVsActualRate: result.budgetSimulation.expectedVsActualRate,
        }
      : null,
    preliminaryHypotheses:
      result.hypotheses?.map((hypothesis) => ({
        id: hypothesis.id,
        pattern: hypothesis.pattern,
        hypothesis: hypothesis.hypothesis,
        confidence: hypothesis.confidence,
      })) ?? [],
  };

  return [
    "あなたはAmazon広告運用のシニアアナリストです。",
    "以下の施策効果比較データを元に、因果仮説と次アクションを日本語で整理してください。",
    "budgetSimulation がある場合は、予算増減を前提に期待売上と実績売上の乖離を明示してください。",
    "preliminaryHypotheses がある場合は、各仮説を 支持 / 否定 / 要追加調査 のいずれかで判定してください。",
    "出力形式:",
    "1. 総合評価（3-5行）",
    "2. 主要な変化要因（箇条書き5点以内）",
    "3. 追加で確認すべき指標/分解軸（箇条書き）",
    "4. 次の2週間アクションプラン（実行順）",
    "5. preliminaryHypotheses判定（idごとに判定理由を1-2行）",
    "",
    JSON.stringify(compact, null, 2),
  ].join("\n");
};

const extractTextFromResponse = (response: unknown): string => {
  const content = (response as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .filter((item) => item.length > 0)
    .join("\n\n")
    .trim();
};

export const runMeasureLlmAnalysis = async (
  result: MeasureCompareResult,
  measureDescription?: string,
): Promise<string | undefined> => {
  const apiKey = getApiKey();
  if (!apiKey) return undefined;

  const anthropicModule = await dynamicImport("@anthropic-ai/sdk");
  const AnthropicCtor = (anthropicModule.default ?? anthropicModule.Anthropic) as
    | (new (options: { apiKey: string }) => {
        messages: {
          create: (options: Record<string, unknown>) => Promise<unknown>;
        };
      })
    | undefined;

  if (!AnthropicCtor) {
    throw new Error("Failed to initialize Anthropic SDK");
  }

  const client = new AnthropicCtor({ apiKey });
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-3-5-sonnet-latest";
  const prompt = buildMeasureAnalysisPrompt(result, measureDescription);
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });

  const text = extractTextFromResponse(response);
  return text === "" ? undefined : text;
};
