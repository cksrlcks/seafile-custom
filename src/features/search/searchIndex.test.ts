import { describe, expect, it } from "vitest";
import { searchEntries } from "./searchIndex";

const names = (list: { name: string }[]) => list.map((e) => e.name);

describe("searchEntries", () => {
  it("matches case-insensitively and puts prefix matches first", () => {
    const r = searchEntries([{ name: "계약서.pdf" }, { name: "Report.xlsx" }, { name: "월간report.md" }, { name: "repo" }], "REP");
    expect(names(r)).toEqual(["repo", "Report.xlsx", "월간report.md"]);
  });

  it("returns nothing for a blank query and respects the limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ name: `file${i}.txt` }));
    expect(searchEntries(many, "  ")).toEqual([]);
    expect(searchEntries(many, "file")).toHaveLength(50);
  });
});
