import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  K3D_CLUSTER_NAME_HASH_LENGTH,
  K3D_CLUSTER_NAME_MAX_LENGTH,
  K3D_CLUSTER_NAME_SUFFIX_LENGTH,
} from "./constants";
import { sanitizeName, shortenK3dClusterName } from "./name";

describe("sanitizeName", () => {
  test("normalizes case and replaces invalid characters", () => {
    expect(sanitizeName(" Feature_X ")).toBe("feature-x");
  });

  test("returns fallback for empty input", () => {
    expect(sanitizeName("---")).toBe("instance");
  });
});

describe("shortenK3dClusterName", () => {
  test("returns original name when within limit", () => {
    const name = "localnet-dev";
    expect(shortenK3dClusterName(name)).toBe(name);
  });

  test("shortens long names with hash and suffix", () => {
    const name = "myproject-my-feature-branch-implementation-6usm";
    const shortened = shortenK3dClusterName(name);
    const expectedHash = createHash("sha256")
      .update(name)
      .digest("hex")
      .slice(0, K3D_CLUSTER_NAME_HASH_LENGTH);
    const suffix = name.split("-").filter(Boolean).at(-1) ?? name;
    const expectedSuffix = suffix.slice(-K3D_CLUSTER_NAME_SUFFIX_LENGTH);

    expect(shortened.length).toBeLessThanOrEqual(K3D_CLUSTER_NAME_MAX_LENGTH);
    expect(shortened.endsWith(`-${expectedHash}-${expectedSuffix}`)).toBe(true);
  });

  test("produces distinct names for long inputs with shared prefix/suffix", () => {
    const nameA = "myproject-my-feature-branch-implementation-alpha-6usm";
    const nameB = "myproject-my-feature-branch-implementation-bravo-6usm";
    const shortenedA = shortenK3dClusterName(nameA);
    const shortenedB = shortenK3dClusterName(nameB);

    expect(shortenedA.length).toBeLessThanOrEqual(K3D_CLUSTER_NAME_MAX_LENGTH);
    expect(shortenedB.length).toBeLessThanOrEqual(K3D_CLUSTER_NAME_MAX_LENGTH);
    expect(shortenedA).not.toBe(shortenedB);
  });
});
