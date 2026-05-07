import { describe, expect, it } from "vitest";

import type { LocalMatchEvent } from "./local-match-loop";
import {
  LocalMatchAudioCueController,
  projectLocalMatchAudioCues,
  type LocalMatchAudioCue,
  type LocalMatchAudioCueOutput
} from "./local-match-audio";

describe("local match audio cues", () => {
  it("projects playable event log entries into lightweight cue kinds", () => {
    const projection = projectLocalMatchAudioCues({
      afterSequence: 2,
      events: [
        event(1, "pitch"),
        event(2, "swing"),
        event(3, "contact", { result: "single" }),
        event(4, "target-hit"),
        event(5, "recovery"),
        event(6, "run"),
        event(7, "match-completed"),
        event(8, "inning-change")
      ]
    });

    expect(projection).toEqual({
      cues: [
        {
          kind: "contact",
          sequence: 3
        },
        {
          kind: "wall-hit",
          sequence: 4
        },
        {
          kind: "recovery",
          sequence: 5
        },
        {
          kind: "run",
          sequence: 6
        },
        {
          kind: "match-complete",
          sequence: 7
        }
      ],
      nextSequence: 8
    });
  });

  it("uses a miss cue for missed contact events", () => {
    expect(
      projectLocalMatchAudioCues({
        events: [event(1, "swing"), event(2, "contact", { result: "miss" })]
      }).cues
    ).toEqual([
      {
        kind: "swing",
        sequence: 1
      },
      {
        kind: "miss",
        sequence: 2
      }
    ]);
  });

  it("does not play before unlock and does not replay skipped startup cues", () => {
    const output = createRecordingOutput();
    const controller = new LocalMatchAudioCueController(output);

    controller.ingest([event(1, "pitch")]);
    controller.unlock();
    controller.ingest([event(1, "pitch"), event(2, "swing")]);

    expect(output.played).toEqual([
      {
        cue: {
          kind: "swing",
          sequence: 2
        },
        reducedIntensity: false
      }
    ]);
  });

  it("respects mute and reduced intensity preferences while advancing sequence", () => {
    const output = createRecordingOutput();
    const controller = new LocalMatchAudioCueController(output, {
      muted: true,
      reducedIntensity: true,
      unlocked: true
    });

    controller.ingest([event(1, "pitch")]);
    controller.setPreferences({
      muted: false,
      reducedIntensity: true
    });
    controller.ingest([event(1, "pitch"), event(2, "run")]);

    expect(output.played).toEqual([
      {
        cue: {
          kind: "run",
          sequence: 2
        },
        reducedIntensity: true
      }
    ]);
  });
});

function createRecordingOutput(): LocalMatchAudioCueOutput & {
  played: { cue: LocalMatchAudioCue; reducedIntensity: boolean }[];
} {
  const played: { cue: LocalMatchAudioCue; reducedIntensity: boolean }[] = [];

  return {
    played,
    playCue: (cue, options) => {
      played.push({
        cue,
        reducedIntensity: options.reducedIntensity
      });
    }
  };
}

function event(
  sequence: number,
  kind: LocalMatchEvent["kind"],
  detail: Partial<LocalMatchEvent> = {}
): LocalMatchEvent {
  return {
    half: "top",
    inning: 1,
    kind,
    playerId: "cainer",
    sequence,
    ...detail
  };
}
