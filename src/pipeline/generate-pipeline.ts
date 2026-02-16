import { buildIdSpine } from "../core/id-spine.js";
import { analyzePlacement } from "../analysis/placement-analyzer.js";
import { generateBudgetRows } from "../generators/block1-budget.js";
import { generateCpcRows } from "../generators/block2-cpc.js";
import { generatePromotionRows } from "../generators/block3-promotion.js";
import { generateNegativeSyncRows } from "../generators/block3-5-negative-sync.js";
import { generateNegativeRows } from "../generators/block4-negative.js";
import { generatePlacementRows } from "../generators/block5-placement.js";
import { buildBulkOutput } from "../generators/bulk-output.js";
import type { GeneratePipelineInput, GeneratePipelineResult, BulkOutputRow } from "./types.js";

const ALL_BLOCKS = [1, 2, 3, 3.5, 4, 5];

export const runGeneratePipeline = (input: GeneratePipelineInput): GeneratePipelineResult => {
  const { analyzeResult, config, strategy, blocks } = input;
  const activeBlocks = blocks.length > 0 ? blocks : ALL_BLOCKS;

  const blockResults: Array<{ label: string; rows: BulkOutputRow[] }> = [];

  // Block 1: Budget adjustment
  if (activeBlocks.includes(1)) {
    const rows = generateBudgetRows(analyzeResult.records, strategy);
    blockResults.push({ label: "block1-budget", rows });
  }

  // Block 2: CPC bid updates
  if (activeBlocks.includes(2)) {
    const rows = generateCpcRows(analyzeResult.cpcRecommendations);
    blockResults.push({ label: "block2-cpc", rows });
  }

  // Build IdSpine for promotion lookups
  const spine = buildIdSpine(analyzeResult.records);

  // Block 3: Auto→Manual promotion
  if (activeBlocks.includes(3)) {
    const rows = generatePromotionRows(analyzeResult.promotionCandidates, spine);
    blockResults.push({ label: "block3-promotion", rows });
  }

  // Block 3.5: Negative sync for promoted keywords
  if (activeBlocks.includes(3.5)) {
    const rows = generateNegativeSyncRows(analyzeResult.promotionCandidates);
    blockResults.push({ label: "block3.5-negative-sync", rows });
  }

  // Block 4: Negative keywords
  if (activeBlocks.includes(4)) {
    const rows = generateNegativeRows(analyzeResult.negativeCandidates);
    blockResults.push({ label: "block4-negative", rows });
  }

  // Block 5: Placement bid modifiers
  if (activeBlocks.includes(5)) {
    const placementRecs = analyzePlacement(analyzeResult.records, config.targetAcos);
    const rows = generatePlacementRows(placementRecs);
    blockResults.push({ label: "block5-placement", rows });
  }

  // Merge and deduplicate
  const allBlockRows = blockResults.map((b) => b.rows);
  const rows = buildBulkOutput(allBlockRows);

  // Build summary
  const blockCounts: Record<string, number> = {};
  for (const b of blockResults) {
    blockCounts[b.label] = b.rows.length;
  }

  return {
    rows,
    summary: {
      blockCounts,
      totalRows: rows.length,
    },
  };
};
