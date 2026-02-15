import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const DEFAULT_POLICY_PATH = path.resolve(CURRENT_DIR, "../../data/campaign-layer-policy.json");

export type CampaignLayerId = "L0" | "L1" | "L2" | "L3" | "L4";

export interface LayerDefinition {
  name: string;
  nameJa: string;
  purpose: string;
  alwaysOn: boolean;
  budgetSharePct: number;
  campaignPrefix: string;
  targetAcos: number;
}

export interface NamingPattern {
  pattern: string;
  layer: CampaignLayerId;
}

export interface PromotionRule {
  from: CampaignLayerId;
  to: CampaignLayerId;
  description: string;
}

export interface CampaignLayerPolicy {
  version: string;
  layers: Record<CampaignLayerId, LayerDefinition>;
  namingPatterns: NamingPattern[];
  fallbackClassification: Record<string, CampaignLayerId>;
  promotionRules: PromotionRule[];
}

const VALID_LAYER_IDS: CampaignLayerId[] = ["L0", "L1", "L2", "L3", "L4"];

const isValidLayerId = (id: string): id is CampaignLayerId => VALID_LAYER_IDS.includes(id as CampaignLayerId);

const validatePolicy = (data: unknown): CampaignLayerPolicy => {
  const policy = data as CampaignLayerPolicy;
  if (!policy.version || typeof policy.version !== "string") {
    throw new Error("campaign-layer-policy: missing or invalid 'version'");
  }
  if (!policy.layers || typeof policy.layers !== "object") {
    throw new Error("campaign-layer-policy: missing or invalid 'layers'");
  }
  for (const id of VALID_LAYER_IDS) {
    const layer = policy.layers[id];
    if (!layer) {
      throw new Error(`campaign-layer-policy: missing layer definition for '${id}'`);
    }
    if (!layer.name || !layer.nameJa || !layer.campaignPrefix) {
      throw new Error(`campaign-layer-policy: incomplete layer definition for '${id}'`);
    }
  }
  if (!Array.isArray(policy.namingPatterns)) {
    throw new Error("campaign-layer-policy: 'namingPatterns' must be an array");
  }
  for (const np of policy.namingPatterns) {
    if (!np.pattern || !isValidLayerId(np.layer)) {
      throw new Error(`campaign-layer-policy: invalid naming pattern: ${JSON.stringify(np)}`);
    }
  }
  if (!policy.fallbackClassification || typeof policy.fallbackClassification !== "object") {
    throw new Error("campaign-layer-policy: missing 'fallbackClassification'");
  }
  if (!Array.isArray(policy.promotionRules)) {
    throw new Error("campaign-layer-policy: 'promotionRules' must be an array");
  }
  return policy;
};

export const loadCampaignLayerPolicy = async (filePath?: string): Promise<CampaignLayerPolicy | undefined> => {
  const target = filePath ?? DEFAULT_POLICY_PATH;
  try {
    const raw = await fs.readFile(target, "utf8");
    const parsed = JSON.parse(raw);
    return validatePolicy(parsed);
  } catch (err) {
    if (!filePath && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw err;
  }
};
