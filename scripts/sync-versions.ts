#!/usr/bin/env bun
/**
 * Syncs version from package.json to .claude-plugin/plugin.json
 * Run after changeset version to keep plugin version in sync.
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const packageJson = JSON.parse(
  readFileSync(join(rootDir, "package.json"), "utf-8")
);

const pluginJsonPath = join(rootDir, ".claude-plugin/plugin.json");
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));

if (pluginJson.version !== packageJson.version) {
  pluginJson.version = packageJson.version;
  writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + "\n");
  console.log(`Synced plugin version to ${packageJson.version}`);
} else {
  console.log(`Plugin version already at ${packageJson.version}`);
}
