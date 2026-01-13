# Silo Implementation Plan

## Goal
Implement `silo` per `SPEC.md` with Bun + TypeScript (strict), delivering the full CLI and example project.

## References to confirm during implementation
- Bun docs for CLI arg parsing, process signals, spawning, file I/O, and executable builds (see bun.sh/llms.txt). These guides exist, but confirm exact APIs and usage as we implement.

## Milestones (ordered)
1. **Scaffold**: repo structure, config, scripts, and lint/tooling per `SPEC.md`.
2. **Types + config**: core types, TOML load, defaults, validation.
3. **Identity + interpolation**: name resolution, host templates, variable phases.
4. **Ports + state files**: allocation logic, env file generation, lockfile read/write.
5. **CLI slice**: `silo env [name]` end-to-end (first vertical slice).
6. **Lifecycle**: `up`, `down`, `status`, hooks, and Tilt + k3d backends.
7. **Example + verification**: example project and test script from spec.
8. **Build/distribution**: Bun single-file executable builds and release commands.

## Work Breakdown
### 1) Scaffold
- Add `src/` layout as described in `SPEC.md` (commands/core/backends/hooks/utils).
- Add TS config (strict), Bun config, and scripts for lint/format/check.
- Add initial README or keep `SPEC.md` as source of truth (no duplication).

### 2) Types + config
- Create core types (`SiloConfig`, `K3dConfig`, `LifecycleHooks`, `InstanceState`, `Lockfile`).
- Load `silo.toml`, apply defaults, and validate required fields.
- Decision: use Bun-native TOML parsing if it matches requirements; otherwise fall back to a small TOML lib. (Confirm via Bun docs.)

### 3) Identity + interpolation
- Implement name resolution (CLI arg -> lockfile -> auto-generate).
- Implement host templates with identity-only variables.
- Implement phased interpolation for URLs and k3d args.

### 4) Ports + state files
- Implement port allocation (default-first, lockfile reuse, ephemeral fallback).
- Implement TCP bind checks with timeout and IPv4 bind.
- Generate env file content and write `.localnet.env`.
- Read/write `.silo.lock` with versioned schema.

### 5) CLI: `silo env`
- Wire CLI parsing and `env` command.
- Ensure env + lockfile generation is deterministic and idempotent.

### 6) Lifecycle: `up`, `down`, `status`
- Tool validation (tilt, k3d if enabled).
- Hooks (pre/post up/down) with env injected and failure handling.
- k3d create/delete + kubeconfig writing.
- Tilt start/foreground handling, pid tracking, Ctrl+C cleanup.
- Status checks for tilt process and k3d cluster existence.

### 7) Example + verification
- Add `example/` directory and scripts from `SPEC.md`.
- Validate `example/test-silo.sh` against implemented features.

### 8) Build/distribution
- Add `bun build --compile` targets per spec.
- Document release/build commands in repo scripts.

## Risks / Open Decisions
- **TOML parsing**: confirm Bun API, otherwise choose lightweight TOML lib.
- **Process detection**: reliable Tilt PID checks across platforms.
- **Timeouts**: standardize timeouts for port checks and subprocess calls.

## Dependencies
- Runtime: `zod` for schema parsing/validation.
- Runtime: Bun native TOML parser (`Bun.TOML.parse`).
- Dev: `bun-types`, `typescript`, `@types/node`.
- Tooling: `oxlint` (lint + format), `knip`, `jscpd`, `lefthook`.

## First implementation target
Deliver Milestones 1–5 so `silo env` works end-to-end with lockfile/env generation.
