import { describe, expect, it } from "vitest";

import { getGameplayControlHelpItems } from "../input/game-controls";
import { projectControlHelpPanel } from "./control-help";

describe("control help panel", () => {
  it("projects compact local and remote onboarding help from gameplay metadata", () => {
    expect(
      projectControlHelpPanel({
        controlItems: getGameplayControlHelpItems(),
        dismissed: false
      })
    ).toEqual({
      dismissed: false,
      title: "Controls",
      summary: "Pick teams, start a local match, then use one set of controls.",
      sections: [
        {
          title: "Gameplay",
          rows: [
            {
              label: "Pitch",
              detail: "Enter or P / Pitch button"
            },
            {
              label: "Swing",
              detail: "Space / Swing button"
            },
            {
              label: "Fielding",
              detail: "Arrow keys or WASD / Fielding pad"
            },
            {
              label: "Pause / Resume",
              detail: "Escape / Pause button"
            },
            {
              label: "Quick Restart",
              detail: "R / Start / Restart button"
            }
          ]
        },
        {
          title: "Match",
          rows: [
            {
              label: "Setup",
              detail: "Use Away/Home in the HUD or team selects."
            },
            {
              label: "Start / Restart",
              detail: "Use HUD Start / Restart, Restart button, or R."
            },
            {
              label: "Results",
              detail: "Finished local matches record in the side panel."
            }
          ]
        },
        {
          title: "Solo",
          rows: [
            {
              label: "Assist",
              detail: "Default opponent actions pitch and recover loose balls."
            },
            {
              label: "Remote Ready",
              detail: "Use Ready after joining a remote room."
            }
          ]
        }
      ]
    });
  });

  it("keeps projected content available when dismissed", () => {
    expect(
      projectControlHelpPanel({
        controlItems: getGameplayControlHelpItems(),
        dismissed: true
      })
    ).toMatchObject({
      dismissed: true,
      title: "Controls"
    });
  });
});
