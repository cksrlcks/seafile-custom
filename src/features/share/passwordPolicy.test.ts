import { describe, expect, it } from "vitest";
import { passwordProblem, strengthLevel } from "./passwordPolicy";

describe("share link password policy (Seafile defaults)", () => {
  it("counts character types", () => {
    expect(strengthLevel("abc")).toBe(1);
    expect(strengthLevel("Abc1!")).toBe(4);
  });

  it("requires 10+ characters and at least 1 type; empty is allowed", () => {
    expect(passwordProblem("")).toBeNull();
    expect(passwordProblem("short1")).toMatch(/10자/);
    expect(passwordProblem("aaaaaaaaaa")).toBeNull();
  });
});
