import { describe, expect, it } from "bun:test";
import type { InstanceState } from "./types";
import { buildSiloProcessEnv } from "./env";

const buildState = (): InstanceState => ({
  name: "main-abc1",
  ports: { WEB_PORT: 3000 },
  identity: {
    name: "main-abc1",
    prefix: "silo",
    composeName: "silo-main-abc1",
    dockerNetwork: "silo-main-abc1",
    volumePrefix: "silo-main-abc1",
    containerPrefix: "silo-main-abc1",
    hosts: { APP_HOST: "main-abc1.localhost" },
  },
  createdAt: "2026-01-01T00:00:00Z",
  k3dClusterCreated: false,
});

describe("buildSiloProcessEnv", () => {
  it("sets silo marker variables for child processes", () => {
    const state = buildState();
    const envFilePath = "/tmp/.localnet.env";
    const env = buildSiloProcessEnv({ state, envFilePath });

    expect(env).toEqual({
      SILO_ACTIVE: "1",
      SILO_WORKSPACE: "main-abc1",
      SILO_ENV_FILE: envFilePath,
    });
  });
});
