import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import ExcelJS from "exceljs";

const exec = promisify(execFile);

const CLI_PATH = path.resolve("src/cli.ts");
const IS_WIN = process.platform === "win32";
const TSX = path.resolve(`node_modules/.bin/tsx${IS_WIN ? ".cmd" : ""}`);

let tmpDir: string;

const runCli = async (
  args: string[],
  opts?: { expectFail?: boolean },
): Promise<{ stdout: string; stderr: string; output: string; exitCode: number }> => {
  try {
    const { stdout, stderr } = await exec(TSX, [CLI_PATH, ...args], {
      env: { ...process.env, LOG_LEVEL: "info" },
      timeout: 30_000,
      shell: IS_WIN,
    });
    return { stdout, stderr, output: stdout + stderr, exitCode: 0 };
  } catch (err: unknown) {
    if (opts?.expectFail) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      const stdout = e.stdout ?? "";
      const stderr = e.stderr ?? "";
      return {
        stdout,
        stderr,
        output: stdout + stderr,
        exitCode: e.code ?? 1,
      };
    }
    throw err;
  }
};

const readXlsx = async (
  filePath: string,
): Promise<{ sheetName: string; headers: string[]; rows: (string | number)[][] }[]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheets: { sheetName: string; headers: string[]; rows: (string | number)[][] }[] = [];

  for (const ws of workbook.worksheets) {
    const allRows: (string | number)[][] = [];
    ws.eachRow((row) => {
      const values = (row.values as (ExcelJS.CellValue | undefined)[]).slice(1);
      allRows.push(
        values.map((v) => {
          if (v === null || v === undefined) return "";
          if (typeof v === "number") return v;
          return String(v);
        }),
      );
    });

    const headers = allRows.length > 0 ? allRows[0].map(String) : [];
    const dataRows = allRows.slice(1);
    sheets.push({ sheetName: ws.name, headers, rows: dataRows });
  }

  return sheets;
};

const writeJson = async (filePath: string, data: unknown): Promise<void> => {
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
};

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "aads-e2e-"));
});

afterAll(async () => {
  if (tmpDir && existsSync(tmpDir)) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

// ── apply-actions E2E ──

describe("E2E: apply-actions", () => {
  it("generates xlsx from action items config with all 4 action types", async () => {
    const configPath = path.join(tmpDir, "actions-all-types.json");
    const outputPath = path.join(tmpDir, "actions-all-types.xlsx");

    await writeJson(configPath, {
      description: "E2E test: all action types",
      actions: [
        {
          type: "negative_keyword",
          campaignId: "C100",
          campaignName: "Campaign Alpha",
          adGroupId: "AG100",
          adGroupName: "AdGroup Alpha",
          keywordText: "bad keyword",
          matchType: "exact",
        },
        {
          type: "negative_keyword",
          campaignId: "C100",
          campaignName: "Campaign Alpha",
          keywordText: "competitor brand",
          matchType: "phrase",
        },
        {
          type: "negative_product_targeting",
          campaignId: "C200",
          campaignName: "Campaign Beta",
          adGroupId: "AG200",
          adGroupName: "AdGroup Beta",
          asin: "B0COMPETITOR",
        },
        {
          type: "keyword",
          campaignId: "C300",
          campaignName: "Campaign Gamma",
          adGroupId: "AG300",
          adGroupName: "AdGroup Gamma",
          keywordText: "new keyword",
          matchType: "phrase",
          bid: 85,
        },
        {
          type: "placement",
          campaignId: "C100",
          campaignName: "Campaign Alpha",
          placement: "Top of Search",
          percentage: 50,
        },
        {
          type: "placement",
          campaignId: "C200",
          campaignName: "Campaign Beta",
          placement: "Product Pages",
          percentage: 30,
        },
      ],
    });

    const { output } = await runCli(["apply-actions", "--config", configPath, "--output", outputPath]);

    // CLI should log success summary (logger.info goes to stdout)
    expect(output).toContain("Action items applied");
    expect(output).toContain('"totalRows":6');

    // Verify xlsx exists and has correct content
    expect(existsSync(outputPath)).toBe(true);
    const sheets = await readXlsx(outputPath);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].sheetName).toBe("Action_Items");

    // Verify header is BULK_SCHEMA_HEADER_V210 (has "SKU / ASIN")
    expect(sheets[0].headers).toContain("SKU / ASIN");
    expect(sheets[0].headers[0]).toBe("Product");
    expect(sheets[0].headers[1]).toBe("Entity");

    const rows = sheets[0].rows;
    expect(rows).toHaveLength(6);

    // Row 0: Negative Keyword (ad group level)
    expect(rows[0][1]).toBe("Negative Keyword"); // Entity
    expect(rows[0][2]).toBe("create"); // Operation
    expect(rows[0][10]).toBe("bad keyword"); // Keyword Text
    expect(String(rows[0][12])).toBe("negative exact"); // Match Type

    // Row 1: Campaign Negative Keyword (campaign level, no adGroupId)
    expect(rows[1][1]).toBe("Campaign Negative Keyword");
    expect(String(rows[1][12])).toBe("negative phrase");

    // Row 2: Negative Product Targeting
    expect(rows[2][1]).toBe("Negative Product Targeting");
    expect(rows[2][11]).toBe('asin="B0COMPETITOR"'); // Product Targeting Expression

    // Row 3: Keyword with bid
    expect(rows[3][1]).toBe("Keyword");
    expect(rows[3][2]).toBe("create");
    expect(rows[3][10]).toBe("new keyword");
    expect(rows[3][16]).toBe(85); // Bid

    // Row 4: Placement - Top of Search
    expect(rows[4][1]).toBe("Campaign");
    expect(rows[4][2]).toBe("update");
    expect(String(rows[4][20])).toBe("50"); // Placement (Top of Search)

    // Row 5: Placement - Product Pages
    expect(rows[5][1]).toBe("Campaign");
    expect(String(rows[5][22])).toBe("30"); // Placement (Product Pages)
  });

  it("generates xlsx with empty actions (0 rows)", async () => {
    const configPath = path.join(tmpDir, "actions-empty.json");
    const outputPath = path.join(tmpDir, "actions-empty.xlsx");

    await writeJson(configPath, { actions: [] });

    const { output } = await runCli(["apply-actions", "--config", configPath, "--output", outputPath]);
    expect(output).toContain('"totalRows":0');

    const sheets = await readXlsx(outputPath);
    expect(sheets[0].rows).toHaveLength(0);
  });

  it("uses sample config and produces correct output", async () => {
    const sampleConfig = path.resolve("data/samples/action-items-sample.json");
    const outputPath = path.join(tmpDir, "actions-sample.xlsx");

    const { output } = await runCli(["apply-actions", "--config", sampleConfig, "--output", outputPath]);
    expect(output).toContain("Action items applied");
    expect(output).toContain('"totalRows":6');

    const sheets = await readXlsx(outputPath);
    expect(sheets[0].rows).toHaveLength(6);

    // Verify all Product column values are "Sponsored Products"
    for (const row of sheets[0].rows) {
      expect(row[0]).toBe("Sponsored Products");
    }
  });

  it("fails gracefully with invalid config (missing actions array)", async () => {
    const configPath = path.join(tmpDir, "actions-invalid.json");
    const outputPath = path.join(tmpDir, "actions-invalid.xlsx");

    await writeJson(configPath, { description: "no actions field" });

    const { output, exitCode } = await runCli(["apply-actions", "--config", configPath, "--output", outputPath], {
      expectFail: true,
    });
    expect(exitCode).not.toBe(0);
    expect(output).toContain("'actions' must be an array");
    expect(existsSync(outputPath)).toBe(false);
  });

  it("fails when config file does not exist", async () => {
    const outputPath = path.join(tmpDir, "actions-nofile.xlsx");

    const { exitCode } = await runCli(
      ["apply-actions", "--config", "/nonexistent/config.json", "--output", outputPath],
      { expectFail: true },
    );
    expect(exitCode).not.toBe(0);
  });
});

// ── create-campaign E2E ──

describe("E2E: create-campaign", () => {
  it("generates xlsx in create mode with auto campaign", async () => {
    const configPath = path.join(tmpDir, "campaign-auto.json");
    const outputPath = path.join(tmpDir, "campaign-auto.xlsx");

    await writeJson(configPath, {
      brandName: "TestBrand",
      brandCode: "TB",
      dateSuffix: "2502",
      skus: ["SKU001", "SKU002"],
      campaigns: {
        auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 },
      },
    });

    const { output } = await runCli(["create-campaign", "--config", configPath, "--output", outputPath]);
    expect(output).toContain("Campaign template generated");
    expect(output).toContain('"mode":"create"');

    const sheets = await readXlsx(outputPath);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].sheetName).toBe("Campaign_Template");

    // Create mode uses B500_CAMPAIGN_HEADER (SKU, not SKU / ASIN)
    expect(sheets[0].headers).toContain("SKU");
    expect(sheets[0].headers).not.toContain("SKU / ASIN");

    const rows = sheets[0].rows;
    // Campaign + AdGroup + 2 ProductAds = 4 rows
    expect(rows).toHaveLength(4);

    // Campaign row
    const campaignRow = rows.find((r) => r[1] === "Campaign");
    expect(campaignRow).toBeDefined();
    expect(campaignRow![3]).toBe("TestBrand_auto_2502"); // Campaign Name
    expect(campaignRow![4]).toBe("TestBrand_auto_2502"); // Campaign ID (temp linkage)
    expect(campaignRow![13]).toBe("auto"); // Campaign Targeting Type
    expect(campaignRow![15]).toBe(1000); // Daily Budget
    expect(campaignRow![19]).toBe("Dynamic bids - down only"); // Bidding Strategy

    // AdGroup row
    const agRow = rows.find((r) => r[1] === "Ad Group");
    expect(agRow).toBeDefined();
    expect(agRow![6]).toBe("TB_auto"); // Ad Group Name
    expect(agRow![8]).toBe(50); // Ad Group Default Bid

    // ProductAd rows
    const paRows = rows.filter((r) => r[1] === "Product Ad");
    expect(paRows).toHaveLength(2);
    expect(paRows[0][9]).toBe("SKU001");
    expect(paRows[1][9]).toBe("SKU002");
  });

  it("generates xlsx with phrase + broad + asin + manual campaigns", async () => {
    const configPath = path.join(tmpDir, "campaign-full.json");
    const outputPath = path.join(tmpDir, "campaign-full.xlsx");

    await writeJson(configPath, {
      brandName: "FullBrand",
      brandCode: "FB",
      dateSuffix: "2502",
      skus: ["SKU_A"],
      negativeKeywords: ["competitor"],
      campaigns: {
        auto: { enabled: true, dailyBudget: 500, defaultBid: 30 },
        phrase: {
          enabled: true,
          dailyBudget: 1000,
          defaultBid: 50,
          keywords: [{ text: "phrase kw", bid: 70 }],
        },
        broad: {
          enabled: true,
          dailyBudget: 800,
          defaultBid: 40,
          keywords: [{ text: "broad kw" }],
        },
        asin: {
          enabled: true,
          dailyBudget: 2000,
          defaultBid: 60,
          targets: [{ asin: "B0COMP", bid: 80 }],
        },
        manual: [
          {
            name: "CustomCamp",
            dailyBudget: 3000,
            targetingType: "manual",
            adGroups: [
              {
                name: "CustomAG",
                defaultBid: 100,
                keywords: [{ text: "exact kw", bid: 120 }],
              },
            ],
          },
        ],
      },
    });

    const { output } = await runCli(["create-campaign", "--config", configPath, "--output", outputPath]);
    expect(output).toContain("Campaign template generated");

    const sheets = await readXlsx(outputPath);
    const rows = sheets[0].rows;

    // Count entity types
    const entityCounts: Record<string, number> = {};
    for (const row of rows) {
      const entity = String(row[1]);
      entityCounts[entity] = (entityCounts[entity] ?? 0) + 1;
    }

    // 5 campaigns (auto, phrase, broad, asin, manual)
    expect(entityCounts["Campaign"]).toBe(5);
    // 5 ad groups
    expect(entityCounts["Ad Group"]).toBe(5);
    // 5 product ads (1 SKU × 5 campaigns)
    expect(entityCounts["Product Ad"]).toBe(5);
    // 3 keywords (phrase:1 + broad:1 + manual:1)
    expect(entityCounts["Keyword"]).toBe(3);
    // 1 product targeting
    expect(entityCounts["Product Targeting"]).toBe(1);
    // 4 campaign negative keywords (auto + phrase + broad + asin × 1 negKW each)
    expect(entityCounts["Campaign Negative Keyword"]).toBe(4);

    // Verify keyword match types
    const kwRows = rows.filter((r) => r[1] === "Keyword");
    const matchTypes = kwRows.map((r) => String(r[12]));
    expect(matchTypes).toContain("phrase");
    expect(matchTypes).toContain("broad");
    expect(matchTypes).toContain("exact");

    // Verify product targeting expression
    const ptRow = rows.find((r) => r[1] === "Product Targeting");
    expect(ptRow![11]).toBe('asin="B0COMP"');
    expect(ptRow![16]).toBe(80); // Bid
  });

  it("uses sample config and produces correct output", async () => {
    const sampleConfig = path.resolve("data/samples/campaign-template-sample.json");
    const outputPath = path.join(tmpDir, "campaign-sample.xlsx");

    const { output } = await runCli(["create-campaign", "--config", sampleConfig, "--output", outputPath]);
    expect(output).toContain("Campaign template generated");
    expect(output).toContain('"totalRows":40');

    const sheets = await readXlsx(outputPath);
    expect(sheets[0].rows.length).toBe(40);

    // Verify naming convention applied (uses SP_ prefix from sample)
    const campaignNames = sheets[0].rows.filter((r) => r[1] === "Campaign").map((r) => String(r[3]));
    expect(campaignNames).toContain("SP_SampleBrand_auto_2502");
    expect(campaignNames).toContain("SP_SampleBrand_phrase_2502");
    expect(campaignNames).toContain("SP_SampleBrand_broad_2502");
    expect(campaignNames).toContain("SP_SampleBrand_asin_2502");
    // Manual campaign uses its own name directly
    expect(campaignNames).toContain("SB_Exact_HighPerf_2502");
  });

  it("applies placement percentages on campaign rows", async () => {
    const configPath = path.join(tmpDir, "campaign-placement.json");
    const outputPath = path.join(tmpDir, "campaign-placement.xlsx");

    await writeJson(configPath, {
      brandName: "PlacementBrand",
      brandCode: "PB",
      dateSuffix: "2502",
      skus: ["SKU001"],
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

    const { output } = await runCli(["create-campaign", "--config", configPath, "--output", outputPath]);
    expect(output).toContain("Campaign template generated");

    const sheets = await readXlsx(outputPath);
    const campaignRow = sheets[0].rows.find((r) => r[1] === "Campaign");
    expect(String(campaignRow![20])).toBe("100"); // Placement (Top of Search)
    expect(String(campaignRow![22])).toBe("50"); // Placement (Product Pages)
  });

  it("fails with invalid config (empty brandName)", async () => {
    const configPath = path.join(tmpDir, "campaign-invalid.json");
    const outputPath = path.join(tmpDir, "campaign-invalid.xlsx");

    await writeJson(configPath, {
      brandName: "",
      brandCode: "TB",
      dateSuffix: "2502",
      skus: ["SKU001"],
      campaigns: {
        auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 },
      },
    });

    const { output, exitCode } = await runCli(["create-campaign", "--config", configPath, "--output", outputPath], {
      expectFail: true,
    });
    expect(exitCode).not.toBe(0);
    expect(output).toContain("brandName");
  });

  it("fails with update mode when --input is not provided", async () => {
    const configPath = path.join(tmpDir, "campaign-update-noinput.json");
    const outputPath = path.join(tmpDir, "campaign-update-noinput.xlsx");

    await writeJson(configPath, {
      brandName: "TestBrand",
      brandCode: "TB",
      dateSuffix: "2502",
      skus: ["SKU001"],
      campaigns: {
        auto: { enabled: true, dailyBudget: 1000, defaultBid: 50 },
      },
    });

    const { output, exitCode } = await runCli(
      ["create-campaign", "--config", configPath, "--output", outputPath, "--mode", "update"],
      { expectFail: true },
    );
    expect(exitCode).not.toBe(0);
    expect(output).toContain("--input is required for update mode");
  });

  it("generates per-campaign SKU overrides correctly", async () => {
    const configPath = path.join(tmpDir, "campaign-sku-override.json");
    const outputPath = path.join(tmpDir, "campaign-sku-override.xlsx");

    await writeJson(configPath, {
      brandName: "SkuBrand",
      brandCode: "SB",
      dateSuffix: "2502",
      skus: ["GLOBAL_SKU1", "GLOBAL_SKU2"],
      campaigns: {
        auto: {
          enabled: true,
          dailyBudget: 500,
          defaultBid: 30,
          skus: ["OVERRIDE_SKU"],
        },
        phrase: {
          enabled: true,
          dailyBudget: 1000,
          defaultBid: 50,
          keywords: [{ text: "kw" }],
          // No per-campaign skus → uses global
        },
      },
    });

    await runCli(["create-campaign", "--config", configPath, "--output", outputPath]);

    const sheets = await readXlsx(outputPath);
    const rows = sheets[0].rows;

    // Auto campaign ProductAds should use OVERRIDE_SKU
    const autoCampaignName = "SkuBrand_auto_2502";
    const autoProductAds = rows.filter((r) => r[1] === "Product Ad" && r[3] === autoCampaignName);
    expect(autoProductAds).toHaveLength(1);
    expect(autoProductAds[0][9]).toBe("OVERRIDE_SKU");

    // Phrase campaign ProductAds should use global SKUs
    const phraseCampaignName = "SkuBrand_phrase_2502";
    const phraseProductAds = rows.filter((r) => r[1] === "Product Ad" && r[3] === phraseCampaignName);
    expect(phraseProductAds).toHaveLength(2);
    expect(phraseProductAds[0][9]).toBe("GLOBAL_SKU1");
    expect(phraseProductAds[1][9]).toBe("GLOBAL_SKU2");
  });

  it("temporary linkage: Campaign ID equals Campaign Name for all rows", async () => {
    const configPath = path.join(tmpDir, "campaign-linkage.json");
    const outputPath = path.join(tmpDir, "campaign-linkage.xlsx");

    await writeJson(configPath, {
      brandName: "LinkBrand",
      brandCode: "LB",
      dateSuffix: "2502",
      skus: ["SKU001"],
      campaigns: {
        auto: { enabled: true, dailyBudget: 500, defaultBid: 30 },
        phrase: {
          enabled: true,
          dailyBudget: 1000,
          defaultBid: 50,
          keywords: [{ text: "link kw" }],
        },
      },
    });

    await runCli(["create-campaign", "--config", configPath, "--output", outputPath]);

    const sheets = await readXlsx(outputPath);
    const rows = sheets[0].rows;

    // All rows within the same campaign should have Campaign ID = Campaign Name
    for (const row of rows) {
      const campaignName = String(row[3]);
      const campaignId = String(row[4]);
      if (campaignName) {
        expect(campaignId).toBe(campaignName);
      }
    }
  });
});

// ── CLI general E2E ──

describe("E2E: CLI general", () => {
  it("shows version", async () => {
    const { stdout } = await runCli(["--version"]);
    expect(stdout.trim()).toBe("1.2.0");
  });

  it("shows help with apply-actions and create-campaign commands", async () => {
    const { stdout } = await runCli(["--help"]);
    expect(stdout).toContain("apply-actions");
    expect(stdout).toContain("create-campaign");
  });
});
