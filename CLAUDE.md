# silo

Isolated local development environments. Solves instance isolation and k3d bootstrap sequencing for Tilt-based projects.

**NPM**: `@0xbigboss/silo`

## Stack

- Runtime: Bun (latest stable)
- Language: TypeScript (strict mode)
- Config: TOML (`silo.toml`)
- Linting: oxlint, oxformat
- Tools: knip, jscpd, lefthook
- Distribution: Bun single-file executable

## Key Files

- `SPEC.md` - Full specification (~1100 lines)
- `example/` - Runnable example with k3d/k8s integration (defined in SPEC.md)

## Commands

```bash
silo up [name]     # Start environment (creates k3d if configured, starts Tilt)
silo down          # Stop Tilt (keeps k3d by default)
silo status        # Show current instance state
silo env [name]    # Generate env file only
```

## Core Concepts

- **Instance isolation**: Ports, Docker volumes, browser cookies via `*.localhost` hostnames
- **k3d bootstrap**: Creates cluster before Tilt starts
- **Default-first ports**: Try configured default, fall back to ephemeral (49152-65535)
- **Variable interpolation**: 5 phases (identity → hosts → ports → urls → k3d.args)
- **Zero-config first run**: Auto-generates name from directory + random suffix

## Releases

Uses changesets for versioning. Plugin version syncs automatically with package.json.

```bash
bun run changeset      # Create changeset (describe what changed)
bun run version        # Bump versions (package.json + plugin.json)
bun run release        # Build and publish to NPM
```

GitHub Actions creates a "Release PR" when changesets exist on main. Merging it publishes to NPM.
