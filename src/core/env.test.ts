import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import type { InstanceState } from "./types";
import { appendGithubEnv, buildSiloProcessEnv } from "./env";

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

describe("appendGithubEnv", () => {
  it("writes env vars in GitHub Actions format", async () => {
    const state: InstanceState = {
      name: "ci-test",
      profile: "e2e",
      ports: { WEB_PORT: 3000, API_PORT: 8080 },
      identity: {
        name: "ci-test",
        prefix: "localnet",
        composeName: "localnet-ci-test",
        dockerNetwork: "localnet-ci-test",
        volumePrefix: "localnet-ci-test",
        containerPrefix: "localnet-ci-test-",
        hosts: { APP_HOST: "ci-test.localhost" },
        k3dClusterName: "localnet-ci-test",
        k3dRegistryName: "localnet-ci-test-registry.localhost",
        kubeconfigPath: "/tmp/kubeconfig-ci-test",
      },
      createdAt: "2026-01-01T00:00:00Z",
      k3dClusterCreated: true,
    };
    const urls = { API_URL: "http://api.ci-test.localhost:8080" };

    const dir = await mkdtemp(path.join(tmpdir(), "silo-env-"));
    const githubEnvPath = path.join(dir, "github.env");

    await appendGithubEnv({ state, urls, githubEnvPath });

    const contents = await readFile(githubEnvPath, "utf8");
    const parsed = Object.fromEntries(
      contents
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [key, ...rest] = line.split("=");
          return [key, rest.join("=")];
        })
    );

    expect(parsed).toEqual({
      API_PORT: "8080",
      API_URL: "http://api.ci-test.localhost:8080",
      APP_HOST: "ci-test.localhost",
      COMPOSE_PROJECT_NAME: "localnet-ci-test",
      CONTAINER_PREFIX: "localnet-ci-test-",
      DOCKER_NETWORK: "localnet-ci-test",
      K3D_CLUSTER_NAME: "localnet-ci-test",
      K3D_REGISTRY_NAME: "localnet-ci-test-registry.localhost",
      KUBECONFIG: "/tmp/kubeconfig-ci-test",
      SILO_PROFILE: "e2e",
      VOLUME_PREFIX: "localnet-ci-test",
      WEB_PORT: "3000",
      WORKSPACE_NAME: "ci-test",
    });
  });
});
