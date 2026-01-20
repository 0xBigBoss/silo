# @0xbigboss/silo

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
