#!/usr/bin/env bun
/**
 * Syncs version from package.json to .claude-plugin/plugin.json and marketplace.json
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
const version = packageJson.version;

// Sync plugin.json
const pluginJsonPath = join(rootDir, ".claude-plugin/plugin.json");
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));

if (pluginJson.version !== version) {
  pluginJson.version = version;
  writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + "\n");
  console.log(`Synced plugin.json version to ${version}`);
} else {
  console.log(`plugin.json version already at ${version}`);
}

// Sync marketplace.json
const marketplaceJsonPath = join(rootDir, ".claude-plugin/marketplace.json");
const marketplaceJson = JSON.parse(readFileSync(marketplaceJsonPath, "utf-8"));
let marketplaceUpdated = false;

if (marketplaceJson.metadata?.version !== version) {
  marketplaceJson.metadata = { ...marketplaceJson.metadata, version };
  marketplaceUpdated = true;
}

const siloPlugin = marketplaceJson.plugins?.find(
  (p: { name: string }) => p.name === "silo"
);
if (siloPlugin && siloPlugin.version !== version) {
  siloPlugin.version = version;
  marketplaceUpdated = true;
}

if (marketplaceUpdated) {
  writeFileSync(
    marketplaceJsonPath,
    JSON.stringify(marketplaceJson, null, 2) + "\n"
  );
  console.log(`Synced marketplace.json version to ${version}`);
} else {
  console.log(`marketplace.json version already at ${version}`);
}
