import { describe, expect, test } from "bun:test";
import { stripDebugOutput } from "./k3d";

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
