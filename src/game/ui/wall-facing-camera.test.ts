import { describe, expect, it } from "vitest";

import {
  calculateWallFacingPitchPosition,
  createWallFacingCameraFrame,
  createWallFacingCameraStyle
} from "./wall-facing-camera";

describe("wall-facing camera frame", () => {
  it("places the pitcher, batter, and wall target in behind-pitcher depth order", () => {
    const frame = createWallFacingCameraFrame();

    expect(frame.pitcher.center.xPercent).toBe(50);
    expect(frame.pitcher.center.yPercent).toBeGreaterThan(80);
    expect(frame.batter.center.yPercent).toBeLessThan(frame.pitcher.center.yPercent);
    expect(frame.wallTarget.center.yPercent).toBeLessThan(frame.batter.center.yPercent);
    expect(frame.wallTarget.center.xPercent).toBe(50);
    expect(frame.pitchPath.from).toEqual(frame.pitcher.releasePoint);
    expect(frame.pitchPath.contact.yPercent).toBeCloseTo(frame.batter.center.yPercent, 1);
  });

  it("keeps mobile control zones out of the active pitch corridor", () => {
    const frame = createWallFacingCameraFrame();
    const pitchZone = frame.controlZones.find((zone) => zone.action === "pitch");
    const swingZone = frame.controlZones.find((zone) => zone.action === "swing");

    expect(pitchZone).toBeDefined();
    expect(swingZone).toBeDefined();
    expect(pitchZone?.bounds.rightPercent).toBeLessThanOrEqual(
      frame.activePlayBounds.leftPercent
    );
    expect(swingZone?.bounds.leftPercent).toBeGreaterThanOrEqual(
      frame.activePlayBounds.rightPercent
    );

    for (const zone of frame.controlZones) {
      expect(zone.bounds.widthPercent).toBeGreaterThanOrEqual(18);
      expect(zone.bounds.heightPercent).toBeGreaterThanOrEqual(20);
      expect(zone.bounds.topPercent).toBeGreaterThanOrEqual(66);
    }
  });

  it("exports camera geometry as CSS custom properties for the prototype", () => {
    const style = createWallFacingCameraStyle(createWallFacingCameraFrame());

    expect(style).toContain("--pitcher-x: 50%;");
    expect(style).toContain("--wall-target-x: 50%;");
    expect(style).toContain("--pitch-control-left: 8%;");
    expect(style).toContain("--swing-control-left: 70%;");
  });

  it("starts pitches at the pitcher release point before tracking into a lane", () => {
    const frame = createWallFacingCameraFrame();
    const start = calculateWallFacingPitchPosition({
      frame,
      laneOffset: -0.2,
      laneWidthPercent: 30,
      progress: 0
    });
    const contact = calculateWallFacingPitchPosition({
      frame,
      laneOffset: -0.2,
      laneWidthPercent: 30,
      progress: 1
    });

    expect(start).toEqual(frame.pitchPath.from);
    expect(contact.xPercent).toBe(44);
    expect(contact.yPercent).toBe(frame.pitchPath.contact.yPercent);
  });
});
