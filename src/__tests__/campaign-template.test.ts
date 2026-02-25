import { describe, it, expect } from "vitest";
import { generateCampaignTemplate } from "../generators/campaign-template.js";
import {
  validateCampaignTemplateConfig,
  formatCampaignName,
  formatAdGroupName,
} from "../config/campaign-template-defaults.js";
import type { CampaignTemplateConfig } from "../config/campaign-template-defaults.js";

const makeConfig = (overrides: Partial<CampaignTemplateConfig> = {}): CampaignTemplateConfig => ({
  brandName: "TestBrand",
  brandCode: "TB",
  dateSuffix: "2502",
  skus: ["SKU001", "SKU002"],
  campaigns: {},
  ...overrides,
});

describe("campaign-template create mode", () => {
  it("generates auto campaign rows (Campaign + AdGroup + ProductAds)", () => {
    const config = makeConfig({
      campaigns: {
        auto: {
          enabled: true,
          dailyBudget: 1000,
          defaultBid: 50,
        },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");

    // Campaign + AdGroup + 2 ProductAds = 4 rows
    expect(rows).toHaveLength(4);

    const campaignRow = rows.find((r) => r.Entity === "Campaign");
    expect(campaignRow).toBeDefined();
    expect(campaignRow!["Campaign Name"]).toBe("TestBrand_auto_2502");
    expect(campaignRow!["Campaign Targeting Type"]).toBe("auto");
    expect(campaignRow!["Daily Budget"]).toBe(1000);
    expect(campaignRow!.Operation).toBe("create");

    // Temporary linkage: Campaign ID = Campaign Name
    expect(campaignRow!["Campaign ID"]).toBe("TestBrand_auto_2502");

    const agRow = rows.find((r) => r.Entity === "Ad Group");
    expect(agRow).toBeDefined();
    expect(agRow!["Ad Group Name"]).toBe("TB_auto");
    expect(agRow!["Ad Group Default Bid"]).toBe(50);

    const productAds = rows.filter((r) => r.Entity === "Product Ad");
    expect(productAds).toHaveLength(2);
    expect(productAds[0]["SKU / ASIN"]).toBe("SKU001");
    expect(productAds[1]["SKU / ASIN"]).toBe("SKU002");
  });

  it("generates phrase campaign with keywords and negative keywords", () => {
    const config = makeConfig({
      campaigns: {
        phrase: {
          enabled: true,
          dailyBudget: 2000,
          defaultBid: 60,
          keywords: [
            { text: "keyword one", bid: 80 },
            { text: "keyword two" },
          ],
        },
      },
      negativeKeywords: ["competitor"],
    });

    const { rows } = generateCampaignTemplate(config, "create");

    const campaignRow = rows.find((r) => r.Entity === "Campaign");
    expect(campaignRow!["Campaign Targeting Type"]).toBe("manual");

    const kwRows = rows.filter((r) => r.Entity === "Keyword");
    expect(kwRows).toHaveLength(2);
    expect(kwRows[0]["Keyword Text"]).toBe("keyword one");
    expect(kwRows[0].Bid).toBe(80);
    expect(kwRows[0]["Match Type"]).toBe("phrase");
    expect(kwRows[1].Bid).toBe(60); // fallback to defaultBid

    const negRows = rows.filter((r) => r.Entity === "Campaign Negative Keyword");
    expect(negRows).toHaveLength(1);
    expect(negRows[0]["Keyword Text"]).toBe("competitor");
  });

  it("generates broad campaign with keywords", () => {
    const config = makeConfig({
      campaigns: {
        broad: {
          enabled: true,
          dailyBudget: 1500,
          defaultBid: 40,
          keywords: [{ text: "broad keyword" }],
        },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");

    const kwRow = rows.find((r) => r.Entity === "Keyword");
    expect(kwRow!["Match Type"]).toBe("broad");
    expect(kwRow!["Campaign Name"]).toBe("TestBrand_broad_2502");
  });

  it("generates asin campaign with product targeting", () => {
    const config = makeConfig({
      campaigns: {
        asin: {
          enabled: true,
          dailyBudget: 3000,
          defaultBid: 70,
          targets: [
            { asin: "B0COMPETITOR1", bid: 90 },
            { asin: "B0COMPETITOR2" },
          ],
        },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");

    const ptRows = rows.filter((r) => r.Entity === "Product Targeting");
    expect(ptRows).toHaveLength(2);
    expect(ptRows[0]["Product Targeting Expression"]).toBe('asin="B0COMPETITOR1"');
    expect(ptRows[0].Bid).toBe(90);
    expect(ptRows[1].Bid).toBe(70); // fallback to defaultBid
  });

  it("generates manual campaign rows", () => {
    const config = makeConfig({
      campaigns: {
        manual: [
          {
            name: "Custom Campaign",
            dailyBudget: 5000,
            targetingType: "manual",
            adGroups: [
              {
                name: "Custom AG",
                defaultBid: 100,
                keywords: [{ text: "custom kw", bid: 120 }],
              },
            ],
          },
        ],
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");

    const campaignRow = rows.find((r) => r.Entity === "Campaign");
    expect(campaignRow!["Campaign Name"]).toBe("Custom Campaign");

    const kwRow = rows.find((r) => r.Entity === "Keyword");
    expect(kwRow!["Keyword Text"]).toBe("custom kw");
    expect(kwRow!.Bid).toBe(120);
  });

  it("generates multiple ProductAd rows per SKU", () => {
    const config = makeConfig({
      skus: ["SKU_A", "SKU_B", "SKU_C"],
      campaigns: {
        auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");
    const productAds = rows.filter((r) => r.Entity === "Product Ad");
    expect(productAds).toHaveLength(3);
  });

  it("uses per-campaign SKU override", () => {
    const config = makeConfig({
      skus: ["GLOBAL_SKU"],
      campaigns: {
        auto: { enabled: true, dailyBudget: 1000, defaultBid: 50, skus: ["OVERRIDE_SKU"] },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");
    const productAds = rows.filter((r) => r.Entity === "Product Ad");
    expect(productAds).toHaveLength(1);
    expect(productAds[0]["SKU / ASIN"]).toBe("OVERRIDE_SKU");
  });

  it("applies default values for bidding strategy", () => {
    const config = makeConfig({
      campaigns: {
        auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");
    const campaignRow = rows.find((r) => r.Entity === "Campaign");
    expect(campaignRow!["Bidding Strategy"]).toBe("Dynamic bids - down only");
  });

  it("sets placement percentages on campaign row", () => {
    const config = makeConfig({
      campaigns: {
        auto: {
          enabled: true,
          dailyBudget: 1000,
          defaultBid: 50,
          topOfSearchPercentage: 100,
          productPagesPercentage: 50,
        },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");
    const campaignRow = rows.find((r) => r.Entity === "Campaign");
    expect(campaignRow!["Placement (Top of Search)"]).toBe("100");
    expect(campaignRow!["Placement (Product Pages)"]).toBe("50");
  });
});

describe("campaign-template naming convention", () => {
  it("uses custom campaign name template", () => {
    const config = makeConfig({
      campaigns: { auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 } },
      naming: {
        campaignTemplate: "SP_{brand}_{code}_{typeLabel}_{suffix}",
      },
    });

    const name = formatCampaignName(config, "auto");
    expect(name).toBe("SP_TestBrand_TB_auto_2502");
  });

  it("uses custom ad group template", () => {
    const config = makeConfig({
      naming: {
        adGroupTemplate: "{brand}_{code}_{descriptor}_group",
      },
    });

    const name = formatAdGroupName(config, "phrase");
    expect(name).toBe("TestBrand_TB_phrase_group");
  });

  it("uses custom type labels", () => {
    const config = makeConfig({
      naming: {
        typeLabels: { auto: "AUTO_TARGETING" },
      },
    });

    const name = formatCampaignName(config, "auto");
    expect(name).toBe("TestBrand_AUTO_TARGETING_2502");
  });

  it("uses custom ad group descriptors", () => {
    const config = makeConfig({
      naming: {
        adGroupDescriptors: { auto: "自動" },
      },
    });

    const name = formatAdGroupName(config, "auto");
    expect(name).toBe("TB_自動");
  });
});

describe("campaign-template validation", () => {
  it("passes for valid config", () => {
    const config = makeConfig({
      campaigns: { auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 } },
    });
    const result = validateCampaignTemplateConfig(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails for empty brandName", () => {
    const config = makeConfig({ brandName: "" });
    const result = validateCampaignTemplateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("brandName is required and must be a non-empty string");
  });

  it("fails for empty skus array", () => {
    const config = makeConfig({ skus: [] });
    const result = validateCampaignTemplateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("skus must be a non-empty array");
  });

  it("fails when no campaign type is enabled", () => {
    const config = makeConfig({
      campaigns: {
        auto: { enabled: false, dailyBudget: 1000, defaultBid: 50 },
      },
    });
    const result = validateCampaignTemplateConfig(config);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one campaign type must be enabled or manual campaigns defined");
  });

  it("fails for null input", () => {
    const result = validateCampaignTemplateConfig(null);
    expect(result.valid).toBe(false);
  });

  it("passes when manual campaigns are defined (even without auto/phrase/broad/asin)", () => {
    const config = makeConfig({
      campaigns: {
        manual: [
          {
            name: "Manual",
            dailyBudget: 1000,
            targetingType: "manual",
            adGroups: [{ name: "AG", defaultBid: 50 }],
          },
        ],
      },
    });
    const result = validateCampaignTemplateConfig(config);
    expect(result.valid).toBe(true);
  });
});

describe("campaign-template temporary linkage", () => {
  it("sets Campaign ID equal to Campaign Name for create mode", () => {
    const config = makeConfig({
      campaigns: {
        auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 },
      },
    });

    const { rows } = generateCampaignTemplate(config, "create");
    const campaignName = "TestBrand_auto_2502";

    for (const row of rows) {
      if (row["Campaign Name"] === campaignName) {
        expect(row["Campaign ID"]).toBe(campaignName);
      }
    }
  });
});
