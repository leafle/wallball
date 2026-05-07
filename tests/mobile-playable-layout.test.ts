import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const styleCss = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

describe("mobile playable layout CSS contract", () => {
  it("centralizes and applies the documented prototype playfield palette", () => {
    expect(styleCss).toContain("--playfield-wall-chestnut: #7b3f2a;");
    expect(styleCss).toContain("--playfield-mound-dusty-brown: #9a755b;");
    expect(styleCss).toContain("--playfield-field-bright-green: #38b94a;");
    expect(styleCss).toContain("--playfield-batter-lane-cement-grey: #8f938a;");

    expect(extractCssBlock(styleCss, ".batting-lab")).toContain(
      "var(--playfield-field-bright-green)"
    );
    expect(extractCssBlock(styleCss, ".wall-zone")).toContain(
      "var(--playfield-wall-chestnut)"
    );
    expect(styleCss).toMatch(
      /\.active-play-corridor\s*\{[^}]*var\(--playfield-batter-lane-cement-grey\)/s
    );
    expect(extractCssBlock(styleCss, ".pitcher-mound")).toContain(
      "var(--playfield-mound-dusty-brown)"
    );
  });

  it("keeps the Phaser canvas full-width and undistorted in phone landscape", () => {
    expect(styleCss).toContain("align-items: start;");

    const landscapeRules = extractCssBlock(
      styleCss,
      "@media (orientation: landscape) and (max-height: 480px)"
    );

    expect(landscapeRules).toContain(".play-surface-grid");
    expect(landscapeRules).toContain("grid-template-columns: 1fr;");
    expect(landscapeRules).toContain(
      "width: min(100%, calc((100svh - 64px) * 16 / 9));"
    );
  });

  it("moves help and secondary panels below the playable field on short phones", () => {
    const landscapeRules = extractCssBlock(
      styleCss,
      "@media (orientation: landscape) and (max-height: 480px)"
    );

    expect(landscapeRules).toContain("order: 3;");
    expect(landscapeRules).toContain(
      "grid-template-columns: repeat(2, minmax(0, 1fr));"
    );
    expect(landscapeRules).toContain("max-height: 42svh;");
    expect(landscapeRules).toContain("overflow: auto;");
  });
});

function extractCssBlock(css: string, selector: string): string {
  const selectorStart = css.indexOf(selector);

  if (selectorStart === -1) {
    throw new Error(`Missing CSS block: ${selector}`);
  }

  const blockStart = css.indexOf("{", selectorStart);

  if (blockStart === -1) {
    throw new Error(`Missing CSS block body: ${selector}`);
  }

  let depth = 0;

  for (let index = blockStart; index < css.length; index += 1) {
    const character = css[index];

    if (character === "{") {
      depth += 1;
    }

    if (character === "}") {
      depth -= 1;
    }

    if (depth === 0) {
      return css.slice(blockStart + 1, index);
    }
  }

  throw new Error(`Unclosed CSS block: ${selector}`);
}
