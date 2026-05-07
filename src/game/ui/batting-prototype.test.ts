import { describe, expect, it } from "vitest";

import { renderBattingPrototypeMarkup } from "./batting-prototype";

describe("batting prototype markup", () => {
  it("renders wall-facing camera actors and mobile-safe control zones", () => {
    const markup = renderBattingPrototypeMarkup();

    expect(markup).toContain("--pitcher-x: 50%;");
    expect(markup).toContain("class=\"wall-target\"");
    expect(markup).toContain("class=\"pitcher-mound\"");
    expect(markup).toContain("class=\"pitcher-marker\"");
    expect(markup).toContain("class=\"batter-marker\"");
    expect(markup).toContain("class=\"control-zone control-zone-pitch\"");
    expect(markup).toContain("class=\"control-zone control-zone-swing\"");
    expect(markup).toContain("data-control-action=\"pitch\"");
    expect(markup).toContain("data-control-action=\"swing\"");
    expect(markup).toContain("aria-keyshortcuts=\"Enter P\"");
    expect(markup).toContain("aria-keyshortcuts=\"Space\"");
  });
});
