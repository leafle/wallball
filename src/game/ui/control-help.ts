import type { GameplayControlHelpItem } from "../input/game-controls";

export interface ControlHelpPanelInput {
  controlItems: GameplayControlHelpItem[];
  dismissed: boolean;
}

export interface ControlHelpPanelProjection {
  dismissed: boolean;
  sections: ControlHelpSection[];
  summary: string;
  title: string;
}

export interface ControlHelpSection {
  rows: ControlHelpRow[];
  title: string;
}

export interface ControlHelpRow {
  detail: string;
  label: string;
}

export function projectControlHelpPanel({
  controlItems,
  dismissed
}: ControlHelpPanelInput): ControlHelpPanelProjection {
  return {
    dismissed,
    title: "Controls",
    summary: "Pick teams, start a local match, then use one set of controls.",
    sections: [
      {
        title: "Gameplay",
        rows: controlItems.map((item) => ({
          label: item.label,
          detail: `${item.keyboard} / ${item.touch}`
        }))
      },
      {
        title: "Match",
        rows: [
          {
            label: "Setup",
            detail: "Tap Away/Home in the game HUD to cycle teams."
          },
          {
            label: "Start / Restart",
            detail: "Tap Start / Restart in the game HUD."
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
  };
}
