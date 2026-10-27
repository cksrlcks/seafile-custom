/// <reference types="node" />
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

const MENU_FILES = ["./context-menu.tsx", "./dropdown-menu.tsx", "./menubar.tsx"];
const ANIMATED = ["./context-menu.tsx", "./dropdown-menu.tsx", "./menubar.tsx", "./dialog.tsx", "./tooltip.tsx"];

describe("menus", () => {
  const styles = (() => {
    try {
      return read("./menu-styles.ts");
    } catch {
      return "";
    }
  })();
  it.each(MENU_FILES)("%s uses shared menu styles", (f) => expect(read(f)).toContain('from "./menu-styles"'));
  it("popup is translucent glass", () => {
    expect(styles).toMatch(/menuPopup = "[^"]*bg-menu/);
    expect(styles).toMatch(/menuPopup = "[^"]*backdrop-blur/);
    expect(styles).toMatch(/menuPopup = "[^"]*shadow-menu/);
  });
  it("highlight is primary, destructive highlight is destructive", () => {
    expect(styles).toMatch(/menuItem = "[^"]*data-highlighted:bg-primary/);
    expect(styles).toMatch(/menuItem = "[^"]*data-\[variant=destructive\]:data-highlighted:bg-destructive/);
  });
});

describe("no web-style motion", () => {
  it.each(ANIMATED)("%s has no zoom or slide animation", (f) => {
    expect(read(f)).not.toMatch(/zoom-(in|out)-|slide-in-from-/);
  });
});
