import { describe, expect, test } from "bun:test";
import { applyRegistryPortOverride } from "./registry";
import { buildInstanceIdentity } from "./identity";
import type { InstanceState, ResolvedConfig } from "./types";

const baseConfig: ResolvedConfig = {
  version: 1,
  prefix: "localnet",
  output: ".localnet.env",
  ports: { K3D_REGISTRY_PORT: 5000 },
  portOrder: ["K3D_REGISTRY_PORT"],
  hosts: { APP_HOST: "${name}.localhost" },
  hostOrder: ["APP_HOST"],
  urls: { REGISTRY_URL: "http://localhost:${K3D_REGISTRY_PORT}" },
  urlOrder: ["REGISTRY_URL"],
  k3d: { enabled: true, registry: { enabled: true } },
  hooks: {},
  profiles: undefined,
  configPath: "/repo/silo.toml",
  projectRoot: "/repo",
};

const buildState = (port: number): InstanceState => {
  const ports = { K3D_REGISTRY_PORT: port };
  const hosts = { APP_HOST: "demo.localhost" };
  const identity = buildInstanceIdentity({
    name: "demo",
    prefix: baseConfig.prefix,
    hosts,
    ports,
    k3dEnabled: true,
    registryEnabled: true,
  });
  return {
    name: "demo",
    ports,
    identity,
    createdAt: "2026-01-01T00:00:00.000Z",
    k3dClusterCreated: true,
  };
};

describe("applyRegistryPortOverride", () => {
  test("updates registry port and urls when drift detected", () => {
    const state = buildState(49157);
    const result = applyRegistryPortOverride({
      state,
      config: baseConfig,
      actualPort: 49163,
    });

    expect(result.changed).toBe(true);
    expect(result.state.ports.K3D_REGISTRY_PORT).toBe(49163);
    expect(result.state.identity.k3dRegistryName).toBe(
      "localnet-demo-registry.localhost:49163"
    );
    expect(result.urls.REGISTRY_URL).toBe("http://localhost:49163");
  });

  test("keeps registry port when actual matches", () => {
    const state = buildState(49157);
    const result = applyRegistryPortOverride({
      state,
      config: baseConfig,
      actualPort: 49157,
    });

    expect(result.changed).toBe(false);
    expect(result.state.ports.K3D_REGISTRY_PORT).toBe(49157);
    expect(result.urls.REGISTRY_URL).toBe("http://localhost:49157");
  });
});
