# @0xbigboss/silo

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
