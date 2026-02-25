import { describe, it, expect } from "vitest";
import { generateActionItemRows } from "../generators/apply-actions.js";
import type { ActionItem } from "../pipeline/types.js";

describe("apply-actions", () => {
  it("generates Negative Keyword row with adGroupId", () => {
    const actions: ActionItem[] = [
      {
        type: "negative_keyword",
        campaignId: "C1",
        campaignName: "Test Campaign",
        adGroupId: "AG1",
        adGroupName: "Test AdGroup",
        keywordText: "bad keyword",
        matchType: "exact",
      },
    ];
    const rows = generateActionItemRows(actions);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Negative Keyword");
    expect(rows[0].Operation).toBe("create");
    expect(rows[0]["Keyword Text"]).toBe("bad keyword");
    expect(rows[0]["Match Type"]).toBe("negative exact");
    expect(rows[0]["Ad Group ID"]).toBe("AG1");
  });

  it("generates Campaign Negative Keyword row without adGroupId", () => {
    const actions: ActionItem[] = [
      {
        type: "negative_keyword",
        campaignId: "C1",
        campaignName: "Test Campaign",
        keywordText: "competitor brand",
        matchType: "phrase",
      },
    ];
    const rows = generateActionItemRows(actions);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Campaign Negative Keyword");
    expect(rows[0]["Match Type"]).toBe("negative phrase");
    expect(rows[0]["Ad Group ID"]).toBe("");
  });

  it("generates Negative Product Targeting row with asin format", () => {
    const actions: ActionItem[] = [
      {
        type: "negative_product_targeting",
        campaignId: "C1",
        campaignName: "Test Campaign",
        adGroupId: "AG1",
        adGroupName: "Test AdGroup",
        asin: "B0COMPETITOR",
      },
    ];
    const rows = generateActionItemRows(actions);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Negative Product Targeting");
    expect(rows[0]["Product Targeting Expression"]).toBe('asin="B0COMPETITOR"');
    expect(rows[0].State).toBe("enabled");
  });

  it("generates Keyword row with bid and matchType", () => {
    const actions: ActionItem[] = [
      {
        type: "keyword",
        campaignId: "C1",
        campaignName: "Manual Campaign",
        adGroupId: "AG1",
        adGroupName: "Phrase AdGroup",
        keywordText: "good keyword",
        matchType: "phrase",
        bid: 75,
      },
    ];
    const rows = generateActionItemRows(actions);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Keyword");
    expect(rows[0].Operation).toBe("create");
    expect(rows[0].Bid).toBe(75);
    expect(rows[0]["Match Type"]).toBe("phrase");
    expect(rows[0]["Keyword Text"]).toBe("good keyword");
  });

  it("generates Campaign placement row with percentage", () => {
    const actions: ActionItem[] = [
      {
        type: "placement",
        campaignId: "C1",
        campaignName: "Test Campaign",
        placement: "Top of Search",
        percentage: 50,
      },
    ];
    const rows = generateActionItemRows(actions);

    expect(rows).toHaveLength(1);
    expect(rows[0].Entity).toBe("Campaign");
    expect(rows[0].Operation).toBe("update");
    expect(rows[0].State).toBe("");
    expect(rows[0]["Placement (Top of Search)"]).toBe("50");
    expect(rows[0].Percentage).toBe("");
  });

  it("returns empty rows for empty actions", () => {
    expect(generateActionItemRows([])).toHaveLength(0);
  });

  it("handles mixed action types", () => {
    const actions: ActionItem[] = [
      {
        type: "negative_keyword",
        campaignId: "C1",
        campaignName: "Campaign A",
        adGroupId: "AG1",
        adGroupName: "AdGroup A",
        keywordText: "bad",
        matchType: "exact",
      },
      {
        type: "keyword",
        campaignId: "C2",
        campaignName: "Campaign B",
        adGroupId: "AG2",
        adGroupName: "AdGroup B",
        keywordText: "good",
        matchType: "broad",
        bid: 100,
      },
      {
        type: "placement",
        campaignId: "C3",
        campaignName: "Campaign C",
        placement: "Product Pages",
        percentage: 25,
      },
      {
        type: "negative_product_targeting",
        campaignId: "C4",
        campaignName: "Campaign D",
        asin: "B0EXAMPLE",
      },
    ];
    const rows = generateActionItemRows(actions);

    expect(rows).toHaveLength(4);
    expect(rows[0].Entity).toBe("Negative Keyword");
    expect(rows[1].Entity).toBe("Keyword");
    expect(rows[2].Entity).toBe("Campaign");
    expect(rows[2]["Placement (Product Pages)"]).toBe("25");
    expect(rows[3].Entity).toBe("Negative Product Targeting");
  });
});
