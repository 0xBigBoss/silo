# @0xbigboss/silo

## 0.5.1

### Patch Changes

- 1110836: Add `silo ci` command with CI env export, document remote Tilt extension usage,
  and add CI health checks for the example workloads.

## 0.5.0

### Minor Changes

- Add SILO\_\* env markers for child processes and ship a Tilt require extension for silo-only runs.

## 0.4.1

### Patch Changes

- fix(k3d): shorten cluster names to stay within 32-char limit

  k3d cluster names cannot exceed 32 characters. When `{prefix}-{name}` exceeds this limit, silo now shortens the name using a deterministic format that preserves uniqueness.

  fix(k3d): reconcile registry port drift between lockfile and actual

  When reusing an existing k3d cluster, the allocated registry port in the lockfile may differ from the actual port bound by Docker. Silo now queries the actual registry port via `docker port` and updates the lockfile if drift is detected.

## 0.4.0

### Minor Changes

- d0ef21d: Add support for `random` or `0` port values to always allocate from the ephemeral range (49152-65535), while still reusing lockfile ports across restarts.

  Fix kubeconfig corruption when k3d outputs debug lines with ANSI escape sequences to stdout.

## 0.3.3

### Patch Changes

- Fix knip configuration to ignore changeset binary

## 0.3.2

### Patch Changes

- Clarify k3d agents and loadbalancer in embedded docs

## 0.3.1

### Patch Changes

- Add colored ASCII art to version command (yellow silo, green ground)

## 0.3.0

### Minor Changes

- Rewrite skill for clarity and add 5 new doc topics (hosts, urls, logging, tilt, troubleshooting)

  - Skill now concise and action-oriented with clear triggers
  - Doc system refactored with --list and --json flags
  - Added doc.test.ts for topic validation
  - Version now embedded at build time via src/version.ts

## 0.2.4

### Patch Changes

- Update skill documentation with all doc topics and version command

## 0.2.3

### Patch Changes

- Add comprehensive documentation topics: commands, lockfile, interpolation, ports, k3d, hooks

## 0.2.2

### Patch Changes

- Add version command and profiles documentation topic

## 0.2.1

### Patch Changes

- Fix Claude Code plugin marketplace structure for proper installation

## 0.2.0

### Minor Changes

- Add profile support for environment-specific configuration overrides

  - New `silo profiles` command to list available profiles
  - `--profile` flag and `SILO_PROFILE` env var for profile selection
  - Profile resolution: flag > env var > lockfile > base config
  - Profile switching requires `--force` flag
  - Profiles can override ports, hosts, urls, k3d settings, and hooks
  - `[profiles.x.append]` section for appending to arrays instead of replacing

  Add Claude Code plugin for AI agent integration

  - `.claude-plugin/plugin.json` manifest for marketplace distribution
  - `skills/silo/SKILL.md` with CLI documentation and usage patterns
  - Teaches AI agents when and how to use silo commands
