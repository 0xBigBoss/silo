import { describe, expect, test } from "bun:test";
import { sanitizeName } from "./name";

describe("sanitizeName", () => {
  test("normalizes case and replaces invalid characters", () => {
    expect(sanitizeName(" Feature_X ")).toBe("feature-x");
  });

  test("returns fallback for empty input", () => {
    expect(sanitizeName("---")).toBe("instance");
  });
});
