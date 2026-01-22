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
});
