import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { safeDivide } from "../core/normalizer.js";
import { analyzePerformance } from "./performance-analyzer.js";
import { runBudgetSimulation } from "./measure-budget-simulation.js";
import { generateHypotheses } from "./measure-hypothesis.js";
import type {
  AnalyzePipelineResult,
  CampaignMetrics,
  MeasureCampaignDiff,
  MeasureCompareResult,
  MeasureCriteriaEvaluation,
  MeasureCriterion,
  MeasureKpiDiff,
  MeasureKpiKey,
  MeasureKpiSnapshot,
  MeasureLogEntry,
  MeasureLogNote,
  MeasureLogStatus,
  MeasurePattern,
  MeasureVerdict,
  NormalizedRecord,
} from "../pipeline/types.js";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const MEASURE_PATTERNS_PATH = path.resolve(CURRENT_DIR, "../../data/measure-patterns.json");
const MEASURE_LOG_PATH = path.resolve(process.cwd(), "data/measure-log.json");

export const MEASURE_KPI_KEYS: MeasureKpiKey[] = [
  "impressions",
  "clicks",
  "spend",
  "sales",
  "orders",
  "ctr",
  "cvr",
  "acos",
  "roas",
  "cpc",
  "cpa",
];

export const MEASURE_KPI_LABELS: Record<MeasureKpiKey, string> = {
  impressions: "Impressions",
  clicks: "Clicks",
  spend: "Spend",
  sales: "Sales",
  orders: "Orders",
  ctr: "CTR",
  cvr: "CVR",
  acos: "ACOS",
  roas: "ROAS",
  cpc: "CPC",
  cpa: "CPA",
};

export interface ListMeasureLogOptions {
  status?: MeasureLogStatus;
  patternId?: string;
}

export interface AddMeasureLogInput {
  patternId: string;
  name: string;
  date: string;
  description?: string;
  status?: MeasureLogStatus;
  note?: string;
}

export interface MeasureRecordFilters {
  campaigns?: string[];
  asins?: string[];
}

export interface CompareMeasureEffectInput {
  before: AnalyzePipelineResult;
  after: AnalyzePipelineResult;
  beforeInput: string;
  afterInput: string;
  pattern: MeasurePattern;
  filters?: MeasureRecordFilters;
  logEntry?: MeasureLogEntry;
  measureName?: string;
  measureDescription?: string;
}

const normalizeToken = (value: string): string => value.trim().toLowerCase();

const sortByDateDesc = (a: MeasureLogEntry, b: MeasureLogEntry): number => {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.createdAt.localeCompare(a.createdAt);
};

const parseDateOrThrow = (value: string): string => {
  const raw = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid date format: ${value}. expected YYYY-MM-DD`);
  }
  const date = new Date(`${raw}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return raw;
};

export const toChangeRate = (before: number, after: number): number => {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return 0;
  if (Math.abs(before) < 1e-9) {
    if (Math.abs(after) < 1e-9) return 0;
    return after > 0 ? 1 : -1;
  }
  return (after - before) / Math.abs(before);
};

const readMeasureLogRaw = async (): Promise<MeasureLogEntry[]> => {
  try {
    const raw = await fs.readFile(MEASURE_LOG_PATH, "utf8");
    const parsed = JSON.parse(raw) as MeasureLogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
};

const writeMeasureLogRaw = async (entries: MeasureLogEntry[]): Promise<void> => {
  await fs.mkdir(path.dirname(MEASURE_LOG_PATH), { recursive: true });
  await fs.writeFile(MEASURE_LOG_PATH, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
};

const shouldRecordBeIncluded = (
  record: NormalizedRecord,
  campaignSet: ReadonlySet<string>,
  asinSet: ReadonlySet<string>,
): boolean => {
  const campaignOk =
    campaignSet.size === 0 ||
    campaignSet.has(normalizeToken(record.campaignId)) ||
    campaignSet.has(normalizeToken(record.campaignName));
  const asinOk = asinSet.size === 0 || asinSet.has(normalizeToken(record.asin));
  return campaignOk && asinOk;
};

const filterRecords = (records: NormalizedRecord[], filters: MeasureRecordFilters): NormalizedRecord[] => {
  if ((filters.campaigns?.length ?? 0) === 0 && (filters.asins?.length ?? 0) === 0) {
    return records;
  }
  const campaignSet = new Set((filters.campaigns ?? []).map(normalizeToken).filter((value) => value !== ""));
  const asinSet = new Set((filters.asins ?? []).map(normalizeToken).filter((value) => value !== ""));
  return records.filter((record) => shouldRecordBeIncluded(record, campaignSet, asinSet));
};

const toSnapshotFromCampaignMetrics = (metrics: CampaignMetrics[]): MeasureKpiSnapshot => {
  const totals = metrics.reduce(
    (acc, item) => {
      acc.impressions += item.impressions;
      acc.clicks += item.clicks;
      acc.spend += item.spend;
      acc.sales += item.sales;
      acc.orders += item.orders;
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
    },
  );

  const ctr = safeDivide(totals.clicks, totals.impressions);
  const cvr = safeDivide(totals.orders, totals.clicks);
  const acos = safeDivide(totals.spend, totals.sales);
  const roas = safeDivide(totals.sales, totals.spend);
  const cpc = safeDivide(totals.spend, totals.clicks);
  const cpa = safeDivide(totals.spend, totals.orders);

  return {
    impressions: totals.impressions,
    clicks: totals.clicks,
    spend: totals.spend,
    sales: totals.sales,
    orders: totals.orders,
    ctr,
    cvr,
    acos,
    roas,
    cpc,
    cpa,
    campaignCount: metrics.length,
  };
};

const toCampaignSnapshot = (metrics?: CampaignMetrics): MeasureKpiSnapshot => {
  if (!metrics) {
    return {
      impressions: 0,
      clicks: 0,
      spend: 0,
      sales: 0,
      orders: 0,
      ctr: 0,
      cvr: 0,
      acos: 0,
      roas: 0,
      cpc: 0,
      cpa: 0,
      campaignCount: 0,
    };
  }

  return {
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    spend: metrics.spend,
    sales: metrics.sales,
    orders: metrics.orders,
    ctr: metrics.ctr,
    cvr: metrics.cvr,
    acos: metrics.acos,
    roas: metrics.roas,
    cpc: safeDivide(metrics.spend, metrics.clicks),
    cpa: safeDivide(metrics.spend, metrics.orders),
    campaignCount: 1,
  };
};

const getKpiValue = (snapshot: MeasureKpiSnapshot, kpi: MeasureKpiKey): number => snapshot[kpi];

const compareKpi = (before: MeasureKpiSnapshot, after: MeasureKpiSnapshot, kpi: MeasureKpiKey): MeasureKpiDiff => {
  const beforeValue = getKpiValue(before, kpi);
  const afterValue = getKpiValue(after, kpi);
  return {
    kpi,
    before: beforeValue,
    after: afterValue,
    diff: afterValue - beforeValue,
    changeRate: toChangeRate(beforeValue, afterValue),
  };
};

const isLowerBetter = (kpi: MeasureKpiKey): boolean => kpi === "acos" || kpi === "cpc" || kpi === "cpa";

const evaluateCriterion = (
  criterion: MeasureCriterion,
  before: MeasureKpiSnapshot,
  after: MeasureKpiSnapshot,
): MeasureCriteriaEvaluation => {
  const beforeValue = getKpiValue(before, criterion.kpi);
  const afterValue = getKpiValue(after, criterion.kpi);
  const changeRate = toChangeRate(beforeValue, afterValue);

  let passed = false;
  if (criterion.direction === "increase") passed = changeRate >= criterion.threshold;
  if (criterion.direction === "decrease") passed = changeRate <= -criterion.threshold;
  if (criterion.direction === "non-increase") passed = changeRate <= criterion.threshold;
  if (criterion.direction === "non-decrease") passed = changeRate >= -criterion.threshold;

  return {
    criterion,
    before: beforeValue,
    after: afterValue,
    changeRate,
    passed,
  };
};

const compareByCampaign = (
  beforeCampaigns: CampaignMetrics[],
  afterCampaigns: CampaignMetrics[],
  focusKpis: MeasureKpiKey[],
): MeasureCampaignDiff[] => {
  const beforeMap = new Map(beforeCampaigns.map((campaign) => [campaign.campaignId || campaign.campaignName, campaign]));
  const afterMap = new Map(afterCampaigns.map((campaign) => [campaign.campaignId || campaign.campaignName, campaign]));
  const keys = new Set<string>([...beforeMap.keys(), ...afterMap.keys()]);

  const rows: MeasureCampaignDiff[] = [];
  for (const key of keys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);
    const beforeSnapshot = toCampaignSnapshot(before);
    const afterSnapshot = toCampaignSnapshot(after);

    rows.push({
      campaignId: after?.campaignId || before?.campaignId || key,
      campaignName: after?.campaignName || before?.campaignName || key,
      isNew: !before && !!after,
      isRemoved: !!before && !after,
      before: beforeSnapshot,
      after: afterSnapshot,
      focusDiffs: focusKpis.map((kpi) => compareKpi(beforeSnapshot, afterSnapshot, kpi)),
    });
  }

  return rows.sort((a, b) => {
    const aDiff = Math.abs(a.after.sales - a.before.sales);
    const bDiff = Math.abs(b.after.sales - b.before.sales);
    return bDiff - aDiff;
  });
};

export const buildKpiSnapshot = (records: NormalizedRecord[]): MeasureKpiSnapshot => {
  const campaignMetrics = analyzePerformance(records);
  return toSnapshotFromCampaignMetrics(campaignMetrics);
};

export const compareKpiSnapshots = (
  before: MeasureKpiSnapshot,
  after: MeasureKpiSnapshot,
  keys: MeasureKpiKey[] = MEASURE_KPI_KEYS,
): MeasureKpiDiff[] => {
  return keys.map((kpi) => compareKpi(before, after, kpi));
};

export const evaluateCriteria = (
  pattern: MeasurePattern,
  before: MeasureKpiSnapshot,
  after: MeasureKpiSnapshot,
): MeasureCriteriaEvaluation[] => {
  return pattern.criteria.map((criterion) => evaluateCriterion(criterion, before, after));
};

export const deriveVerdict = (
  criteriaEvaluations: MeasureCriteriaEvaluation[],
  focusDiffs: MeasureKpiDiff[],
): MeasureVerdict => {
  if (criteriaEvaluations.length > 0) {
    const passedCount = criteriaEvaluations.filter((item) => item.passed).length;
    if (passedCount === criteriaEvaluations.length) return "improved";
    if (passedCount === 0) return "degraded";
    return "neutral";
  }

  if (focusDiffs.length === 0) return "neutral";
  const score = focusDiffs.reduce((acc, item) => {
    const direction = isLowerBetter(item.kpi) ? -1 : 1;
    if (Math.abs(item.changeRate) < 1e-9) return acc;
    return acc + (item.changeRate > 0 ? 1 : -1) * direction;
  }, 0);

  if (score > 0) return "improved";
  if (score < 0) return "degraded";
  return "neutral";
};

export const loadMeasurePatterns = async (): Promise<MeasurePattern[]> => {
  const raw = await fs.readFile(MEASURE_PATTERNS_PATH, "utf8");
  const parsed = JSON.parse(raw) as MeasurePattern[];
  if (!Array.isArray(parsed)) {
    throw new Error(`Invalid measure patterns: ${MEASURE_PATTERNS_PATH}`);
  }
  return parsed;
};

export const getMeasurePatternById = async (patternId: string): Promise<MeasurePattern | undefined> => {
  const patterns = await loadMeasurePatterns();
  return patterns.find((pattern) => pattern.id === patternId);
};

export const listMeasureLogs = async (options?: ListMeasureLogOptions): Promise<MeasureLogEntry[]> => {
  const entries = await readMeasureLogRaw();
  return entries
    .filter((entry) => {
      if (options?.status && entry.status !== options.status) return false;
      if (options?.patternId && entry.patternId !== options.patternId) return false;
      return true;
    })
    .sort(sortByDateDesc);
};

export const getMeasureLogById = async (id: string): Promise<MeasureLogEntry | undefined> => {
  const entries = await readMeasureLogRaw();
  return entries.find((entry) => entry.id === id);
};

export const addMeasureLog = async (input: AddMeasureLogInput): Promise<MeasureLogEntry> => {
  const date = parseDateOrThrow(input.date);
  const now = new Date().toISOString();
  const entry: MeasureLogEntry = {
    id: randomUUID(),
    patternId: input.patternId,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    date,
    status: input.status ?? "pending",
    createdAt: now,
    updatedAt: now,
    ...(input.note ? { notes: [{ text: input.note.trim(), createdAt: now }] } : {}),
  };

  const entries = await readMeasureLogRaw();
  entries.push(entry);
  await writeMeasureLogRaw(entries);
  return entry;
};

export const removeMeasureLog = async (id: string): Promise<boolean> => {
  const entries = await readMeasureLogRaw();
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) return false;
  await writeMeasureLogRaw(next);
  return true;
};

export const addNoteToMeasureLog = async (
  id: string,
  text: string,
): Promise<MeasureLogEntry | undefined> => {
  const entries = await readMeasureLogRaw();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return undefined;

  const now = new Date().toISOString();
  const note: MeasureLogNote = { text: text.trim(), createdAt: now };
  const existing = entries[index].notes ?? [];

  const updated: MeasureLogEntry = {
    ...entries[index],
    notes: [...existing, note],
    updatedAt: now,
  };

  entries[index] = updated;
  await writeMeasureLogRaw(entries);
  return updated;
};

export const saveMeasureCompareToLog = async (
  logId: string,
  result: MeasureCompareResult,
): Promise<MeasureLogEntry | undefined> => {
  const entries = await readMeasureLogRaw();
  const index = entries.findIndex((entry) => entry.id === logId);
  if (index < 0) return undefined;

  const updated: MeasureLogEntry = {
    ...entries[index],
    status: "completed",
    updatedAt: new Date().toISOString(),
    lastCompare: result,
  };

  entries[index] = updated;
  await writeMeasureLogRaw(entries);
  return updated;
};

export const compareMeasureEffect = (input: CompareMeasureEffectInput): MeasureCompareResult => {
  const filterCampaigns = (input.filters?.campaigns ?? []).map((v) => v.trim()).filter((v) => v !== "");
  const filterAsins = (input.filters?.asins ?? []).map((v) => v.trim()).filter((v) => v !== "");
  const filters: MeasureRecordFilters = { campaigns: filterCampaigns, asins: filterAsins };

  const beforeRecords = filterRecords(input.before.records, filters);
  const afterRecords = filterRecords(input.after.records, filters);

  const beforeCampaigns = analyzePerformance(beforeRecords);
  const afterCampaigns = analyzePerformance(afterRecords);
  const beforeSnapshot = toSnapshotFromCampaignMetrics(beforeCampaigns);
  const afterSnapshot = toSnapshotFromCampaignMetrics(afterCampaigns);
  const overallDiffs = compareKpiSnapshots(beforeSnapshot, afterSnapshot, MEASURE_KPI_KEYS);
  const focusDiffs = compareKpiSnapshots(beforeSnapshot, afterSnapshot, input.pattern.focusKpis);
  const criteriaEvaluations = evaluateCriteria(input.pattern, beforeSnapshot, afterSnapshot);
  const verdict = deriveVerdict(criteriaEvaluations, focusDiffs);
  const campaignDiffs = compareByCampaign(beforeCampaigns, afterCampaigns, input.pattern.focusKpis);
  const beforeDays = input.before.dateRange?.days ?? 0;
  const afterDays = input.after.dateRange?.days ?? 0;
  const budgetSimulation = runBudgetSimulation(
    beforeCampaigns,
    afterCampaigns,
    beforeSnapshot,
    afterSnapshot,
    beforeDays,
    afterDays,
  );
  const hypotheses = generateHypotheses({
    overallDiffs,
    focusDiffs,
    budgetSimulation,
    campaignDiffs,
  });

  return {
    generatedAt: new Date().toISOString(),
    patternId: input.pattern.id,
    patternName: input.pattern.name,
    logId: input.logEntry?.id,
    measureName: input.measureName || input.logEntry?.name,
    measureDescription: input.measureDescription || input.logEntry?.description,
    focusKpis: input.pattern.focusKpis,
    verdict,
    beforeInput: input.beforeInput,
    afterInput: input.afterInput,
    beforeDateRange: input.before.dateRange,
    afterDateRange: input.after.dateRange,
    filters: {
      campaigns: filterCampaigns,
      asins: filterAsins,
    },
    overallBefore: beforeSnapshot,
    overallAfter: afterSnapshot,
    overallDiffs,
    focusDiffs,
    criteriaEvaluations,
    campaignDiffs,
    budgetSimulation,
    hypotheses,
  };
};

export const calcMeasureReminder = (
  entry: MeasureLogEntry,
  pattern: MeasurePattern,
  now?: Date,
): { daysElapsed: number; reminder: string } => {
  const today = now ?? new Date();
  const entryDate = new Date(`${entry.date}T00:00:00+09:00`);
  const daysElapsed = Math.floor((today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));
  const windowDays = pattern.recommendedWindowDays;

  if (entry.status === "completed") return { daysElapsed, reminder: "" };
  if (entry.lastCompare) return { daysElapsed, reminder: "" };
  if (daysElapsed >= windowDays) return { daysElapsed, reminder: `比較推奨（${daysElapsed}日経過）` };
  const remaining = windowDays - daysElapsed;
  return { daysElapsed, reminder: `${remaining}日後` };
};
