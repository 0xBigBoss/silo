import { describe, expect, test } from "bun:test";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  test("accepts random ports and 0 as an alias", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "silo-config-"));
    try {
      const configPath = path.join(tempDir, "silo.toml");
      await fs.writeFile(
        configPath,
        `version = 1

[ports]
WEB_PORT = "random"
API_PORT = 0
`
      );

      const config = await loadConfig(configPath);
      expect(config.ports.WEB_PORT).toBe("random");
      expect(config.ports.API_PORT).toBe("random");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  test("accepts registry advertisement settings", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "silo-config-"));
    try {
      const configPath = path.join(tempDir, "silo.toml");
      const content = [
        "version = 1",
        "",
        "[ports]",
        "K3D_REGISTRY_PORT = 5000",
        "",
        "[k3d]",
        "enabled = true",
        "",
        "[k3d.registry]",
        "enabled = true",
        "advertise = true",
        'host = "localhost:${K3D_REGISTRY_PORT}"',
        'hostFromContainerRuntime = "registry.localhost:5000"',
        'hostFromClusterNetwork = "registry.localhost:5000"',
        'help = "See docs"',
        "",
        "[registry]",
        "advertise = true",
        'host = "127.0.0.1:5001"',
        "",
      ].join("\n");
      await fs.writeFile(configPath, content);

      const config = await loadConfig(configPath);
      expect(config.k3d?.registry?.enabled).toBe(true);
      expect(config.k3d?.registry?.advertise).toBe(true);
      expect(config.k3d?.registry?.host).toBe("localhost:${K3D_REGISTRY_PORT}");
      expect(config.registry?.advertise).toBe(true);
      expect(config.registry?.host).toBe("127.0.0.1:5001");
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
