import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const css = read("../../index.css");
const block = (sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf("\n}", css.indexOf(`${sel} {`)));

const TOKENS = ["--menu", "--menu-separator", "--dialog-footer", "--dialog-footer-border", "--primary-hover", "--primary-active",
  "--destructive-hover", "--outline-hover", "--primary-edge", "--primary-edge-bottom", "--outline-edge", "--outline-edge-bottom",
  "--destructive-edge", "--destructive-edge-bottom"];

describe("desktop design tokens", () => {
  it.each(TOKENS)("%s is defined for light and dark", (t) => {
    expect(block(":root")).toContain(`${t}:`);
    expect(block(".dark")).toContain(`${t}:`);
  });
  it.each(["--shadow-menu", "--shadow-dialog", "--shadow-button", "--shadow-button-subtle"])("%s is a theme shadow", (t) => {
    expect(block("@theme inline")).toContain(`${t}:`);
  });
});
