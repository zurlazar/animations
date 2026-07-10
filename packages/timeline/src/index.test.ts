import { describe, expect, it } from "vitest";
import { easing, lerp, Spring } from "./index.js";

describe("easing", () => {
  it("all curves map endpoints 0->0 and 1->1", () => {
    for (const [name, fn] of Object.entries(easing)) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 5);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 5);
    }
  });

  it("clamps out-of-range input", () => {
    expect(easing.linear(-1)).toBe(0);
    expect(easing.cubicIn(2)).toBe(1);
  });
});

describe("lerp", () => {
  it("interpolates", () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(-4, 4, 0.25)).toBe(-2);
  });
});

describe("Spring", () => {
  it("converges to its target", () => {
    const s = new Spring(0);
    let v = 0;
    for (let i = 0; i < 300; i++) v = s.step(10, 1 / 60);
    expect(v).toBeCloseTo(10, 1);
    expect(s.isSettled(10)).toBe(true);
  });

  it("stays stable under a large dt spike", () => {
    const s = new Spring(0);
    const v = s.step(100, 2); // 2-second frame
    expect(Number.isFinite(v)).toBe(true);
    expect(Math.abs(v)).toBeLessThan(1000);
  });
});
