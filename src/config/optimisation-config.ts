import { OPTIMIZATION_DEFAULTS } from "./constants.js";

export interface OptimisationConfig {
  targetAcos: number;
  minClicksForCpc: number;
  minClicksForPromotion: number;
  minCvrForPromotion: number;
  negativeAcosThreshold: number;
  sale: {
    enabled: boolean;
    cpcReductionFactor: number;
    defaultCpc: number;
  };
  b190: {
    impressionThreshold: number;
    spendThreshold: number;
    cpcThreshold: number;
  };
  seo: {
    enabled: boolean;
    cpcCeiling: number;
    factors: Record<number, number>;
  };
}

const numberFromEnv = (name: string, fallback: number): number => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const boolFromEnv = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }
  return /^(1|true|yes|on)$/i.test(value);
};

export const loadOptimisationConfig = (): OptimisationConfig => {
  return {
    targetAcos: numberFromEnv("TARGET_ACOS", OPTIMIZATION_DEFAULTS.targetAcos),
    minClicksForCpc: numberFromEnv("MIN_CLICKS_CPC", OPTIMIZATION_DEFAULTS.minClicksForCpc),
    minClicksForPromotion: numberFromEnv("MIN_CLICKS_PROMOTION", OPTIMIZATION_DEFAULTS.minClicksForPromotion),
    minCvrForPromotion: numberFromEnv("MIN_CVR_PROMOTION", OPTIMIZATION_DEFAULTS.minCvrForPromotion),
    negativeAcosThreshold: numberFromEnv("NEGATIVE_ACOS_THRESHOLD", OPTIMIZATION_DEFAULTS.negativeAcosThreshold),
    sale: {
      enabled: boolFromEnv("SALE_ENABLED", OPTIMIZATION_DEFAULTS.sale.enabled),
      cpcReductionFactor: numberFromEnv("SALE_CPC_REDUCTION_FACTOR", OPTIMIZATION_DEFAULTS.sale.cpcReductionFactor),
      defaultCpc: numberFromEnv("SALE_DEFAULT_CPC", OPTIMIZATION_DEFAULTS.sale.defaultCpc),
    },
    b190: {
      impressionThreshold: numberFromEnv("B190_IMPRESSION_THRESHOLD", OPTIMIZATION_DEFAULTS.b190.impressionThreshold),
      spendThreshold: numberFromEnv("B190_SPEND_THRESHOLD", OPTIMIZATION_DEFAULTS.b190.spendThreshold),
      cpcThreshold: numberFromEnv("B190_CPC_THRESHOLD", OPTIMIZATION_DEFAULTS.b190.cpcThreshold),
    },
    seo: {
      enabled: boolFromEnv("SEO_ENABLED", OPTIMIZATION_DEFAULTS.seo.enabled),
      cpcCeiling: numberFromEnv("SEO_CPC_CEILING", OPTIMIZATION_DEFAULTS.seo.cpcCeiling),
      factors: OPTIMIZATION_DEFAULTS.seo.factors,
    },
  };
};
