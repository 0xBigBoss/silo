import { describe, expect, test } from "bun:test";
import type { CommandResult } from "../utils/exec";
import { ensureCluster, type EnsureClusterDeps, stripDebugOutput } from "./k3d";

const commandResult = (params: Partial<CommandResult> = {}): CommandResult => ({
  exitCode: params.exitCode ?? 0,
  stdout: params.stdout ?? "",
  stderr: params.stderr ?? "",
});

describe("stripDebugOutput", () => {
  test("preserves clean YAML", () => {
    const yaml = `apiVersion: v1
kind: Config
clusters:
- cluster:
    server: https://localhost:6443
  name: k3d-test`;
    expect(stripDebugOutput(yaml)).toBe(yaml);
  });

  test("strips ANSI escape sequences", () => {
    const dirty = `\x1b[37mDEBU\x1b[0m[0000] some debug message
apiVersion: v1
kind: Config`;
    const expected = `apiVersion: v1
kind: Config`;
    expect(stripDebugOutput(dirty)).toBe(expected);
  });

  test("strips logrus debug lines without ANSI", () => {
    const dirty = `DEBU[0000] some debug message
INFO[0001] another message
apiVersion: v1
kind: Config`;
    const expected = `apiVersion: v1
kind: Config`;
    expect(stripDebugOutput(dirty)).toBe(expected);
  });

  test("strips mixed debug output from real k3d output", () => {
    const dirty = `\x1b[37mDEBU\x1b[0m[0000] Runtime Info: &{Name:docker Endpoint:/var/run/docker.sock}
\x1b[37mDEBU\x1b[0m[0000] Loaded config file path: /home/user/.config/k3d/config.yaml
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: LS0tLS1...
    server: https://0.0.0.0:43215
  name: k3d-silo-test
contexts:
- context:
    cluster: k3d-silo-test
    user: admin@k3d-silo-test
  name: k3d-silo-test
current-context: k3d-silo-test
kind: Config
preferences: {}
users:
- name: admin@k3d-silo-test
  user:
    client-certificate-data: LS0tLS1...
    client-key-data: LS0tLS1...`;
    const result = stripDebugOutput(dirty);
    expect(result).toStartWith("apiVersion: v1");
    expect(result).not.toContain("DEBU");
    expect(result).not.toContain("\x1b");
  });

  test("handles empty input", () => {
    expect(stripDebugOutput("")).toBe("");
  });

  test("handles input with only debug lines", () => {
    const dirty = `DEBU[0000] message 1
DEBU[0001] message 2`;
    expect(stripDebugOutput(dirty)).toBe("");
  });
});

describe("ensureCluster", () => {
  const params = {
    clusterName: "localnet-demo",
    registryName: "localnet-demo-registry.localhost:5000",
    args: ["--wait"],
    cwd: "/repo",
  };

  test("reuses existing healthy cluster", async () => {
    const calls: string[][] = [];
    const checkedCalls: string[][] = [];
    const responses: CommandResult[] = [
      commandResult({ stdout: "localnet-demo\n" }),
      commandResult({ stdout: '[{"name":"localnet-demo-registry.localhost"}]' }),
      commandResult({ stdout: "k3d-localnet-demo-registry.localhost\n" }),
    ];

    const deps: EnsureClusterDeps = {
      runCommand: async (cmd) => {
        calls.push(cmd);
        const result = responses.shift();
        if (!result) {
          throw new Error(`unexpected runCommand call: ${cmd.join(" ")}`);
        }
        return result;
      },
      runCommandChecked: async (cmd) => {
        checkedCalls.push(cmd);
        return commandResult();
      },
    };

    const result = await ensureCluster(params, deps);

    expect(result.created).toBe(false);
    expect(checkedCalls).toHaveLength(0);
    expect(calls.map((call) => call.join(" "))).toEqual([
      "k3d cluster list",
      "k3d registry list -o json",
      "docker ps --format {{.Names}}",
    ]);
  });

  test("recreates stale existing cluster when registry container is missing", async () => {
    const checkedCalls: string[][] = [];
    const responses: CommandResult[] = [
      commandResult({ stdout: "localnet-demo\n" }),
      commandResult({ stdout: '[{"name":"localnet-demo-registry.localhost"}]' }),
      commandResult({ stdout: "" }),
    ];

    const deps: EnsureClusterDeps = {
      runCommand: async (cmd) => {
        const result = responses.shift();
        if (!result) {
          throw new Error(`unexpected runCommand call: ${cmd.join(" ")}`);
        }
        return result;
      },
      runCommandChecked: async (cmd) => {
        checkedCalls.push(cmd);
        return commandResult();
      },
    };

    const result = await ensureCluster(params, deps);

    expect(result.created).toBe(true);
    expect(checkedCalls.map((call) => call.join(" "))).toEqual([
      "k3d cluster delete localnet-demo",
      "k3d cluster create localnet-demo --kubeconfig-update-default=false --kubeconfig-switch-context=false --registry-create localnet-demo-registry.localhost:5000 --wait",
    ]);
  });

  test("creates cluster when missing", async () => {
    const checkedCalls: string[][] = [];
    const deps: EnsureClusterDeps = {
      runCommand: async () => commandResult({ stdout: "" }),
      runCommandChecked: async (cmd) => {
        checkedCalls.push(cmd);
        return commandResult();
      },
    };

    const result = await ensureCluster(params, deps);

    expect(result.created).toBe(true);
    expect(checkedCalls).toHaveLength(1);
    expect(checkedCalls[0]?.join(" ")).toBe(
      "k3d cluster create localnet-demo --kubeconfig-update-default=false --kubeconfig-switch-context=false --registry-create localnet-demo-registry.localhost:5000 --wait"
    );
  });

  test("does not delete cluster when registry health check is inconclusive", async () => {
    const checkedCalls: string[][] = [];
    const responses: CommandResult[] = [
      commandResult({ stdout: "localnet-demo\n" }),
      commandResult({ exitCode: 1 }),
    ];

    const deps: EnsureClusterDeps = {
      runCommand: async (cmd) => {
        const result = responses.shift();
        if (!result) {
          throw new Error(`unexpected runCommand call: ${cmd.join(" ")}`);
        }
        return result;
      },
      runCommandChecked: async (cmd) => {
        checkedCalls.push(cmd);
        return commandResult();
      },
    };

    const result = await ensureCluster(params, deps);

    expect(result.created).toBe(false);
    expect(checkedCalls).toHaveLength(0);
  });

  test("treats partial container-name matches as stale", async () => {
    const checkedCalls: string[][] = [];
    const responses: CommandResult[] = [
      commandResult({ stdout: "localnet-demo\n" }),
      commandResult({ stdout: '[{"name":"localnet-demo-registry.localhost"}]' }),
      commandResult({ stdout: "foo-localnet-demo-registry.localhost-backup\n" }),
    ];

    const deps: EnsureClusterDeps = {
      runCommand: async (cmd) => {
        const result = responses.shift();
        if (!result) {
          throw new Error(`unexpected runCommand call: ${cmd.join(" ")}`);
        }
        return result;
      },
      runCommandChecked: async (cmd) => {
        checkedCalls.push(cmd);
        return commandResult();
      },
    };

    const result = await ensureCluster(params, deps);

    expect(result.created).toBe(true);
    expect(checkedCalls.map((call) => call.join(" "))).toEqual([
      "k3d cluster delete localnet-demo",
      "k3d cluster create localnet-demo --kubeconfig-update-default=false --kubeconfig-switch-context=false --registry-create localnet-demo-registry.localhost:5000 --wait",
    ]);
  });
});
