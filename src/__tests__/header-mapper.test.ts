import { describe, it, expect } from "vitest";
import { findHeader, createHeaderMap } from "../core/header-mapper.js";

describe("findHeader", () => {
  it("finds exact match", () => {
    const headers = ["Campaign ID", "Campaign Name", "Clicks"];
    expect(findHeader(headers, ["Campaign ID"])).toBe(0);
    expect(findHeader(headers, ["Campaign Name"])).toBe(1);
    expect(findHeader(headers, ["Clicks"])).toBe(2);
  });

  it("finds Japanese header", () => {
    const headers = ["キャンペーンID", "キャンペーン名", "クリック数"];
    expect(findHeader(headers, ["Campaign ID", "キャンペーンID"])).toBe(0);
    expect(findHeader(headers, ["Campaign Name", "キャンペーン名"])).toBe(1);
    expect(findHeader(headers, ["Clicks", "クリック数"])).toBe(2);
  });

  it("returns -1 for missing header", () => {
    const headers = ["Campaign ID", "Clicks"];
    expect(findHeader(headers, ["NonExistent"])).toBe(-1);
  });

  it("returns -1 for empty headers", () => {
    expect(findHeader([], ["Campaign ID"])).toBe(-1);
  });

  it("uses normalized matching as fallback", () => {
    const headers = ["  campaign name  "];
    expect(findHeader(headers, ["Campaign Name"])).toBe(0);
  });
});

describe("createHeaderMap", () => {
  it("maps English headers", () => {
    const headers = [
      "Campaign ID",
      "Campaign Name",
      "Ad Group ID",
      "Ad Group Name",
      "Keyword ID",
      "Keyword Text",
      "Match Type",
      "Clicks",
      "Impressions",
      "Spend",
      "Sales",
      "Orders",
      "State",
    ];
    const map = createHeaderMap(headers);
    expect(map.campaignId).toBe(0);
    expect(map.campaignName).toBe(1);
    expect(map.clicks).toBe(7);
    expect(map.spend).toBe(9);
    expect(map.sales).toBe(10);
    expect(map.state).toBe(12);
  });

  it("maps Japanese headers", () => {
    const headers = [
      "キャンペーンID",
      "キャンペーン名",
      "広告グループID",
      "広告グループ名",
      "キーワードID",
      "キーワードテキスト",
      "マッチタイプ",
      "クリック数",
      "インプレッション数",
      "支出",
      "売上",
      "注文数",
    ];
    const map = createHeaderMap(headers);
    expect(map.campaignId).toBe(0);
    expect(map.campaignName).toBe(1);
    expect(map.clicks).toBe(7);
    expect(map.spend).toBe(9);
    expect(map.sales).toBe(10);
    expect(map.orders).toBe(11);
  });
});
