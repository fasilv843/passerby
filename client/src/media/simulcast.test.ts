import { describe, expect, it } from "vitest";
import { preferredSpatialLayer, SIMULCAST_ENCODINGS } from "./simulcast";

describe("simulcast", () => {
  it("sends three layers, smallest first", () => {
    expect(SIMULCAST_ENCODINGS.map((e) => e.scaleResolutionDownBy)).toEqual([4, 2, 1]);
  });

  it("picks smaller layers as tiles get smaller", () => {
    expect([0, 1, 2, 3, 4, 5].map(preferredSpatialLayer)).toEqual([2, 2, 1, 1, 0, 0]);
  });
});
