---
name: silo
description: Use silo for Tilt-based local dev environments with isolated ports, k3d clusters, and browser cookies. Triggers on silo.toml, "silo up", local k3d/Tilt setup, or port isolation needs.
---

# silo CLI

silo manages isolated local development environments for Tilt-based projects. It handles port allocation, k3d cluster creation, and browser cookie isolation via `*.localhost` hostnames.

## When to Use silo

Use silo when the project has a `silo.toml` file or needs:
- Multiple instances of the same project running simultaneously
- Isolated ports, Docker volumes, and browser cookies per instance
- k3d cluster bootstrapping before Tilt starts
- Environment-specific configuration via profiles

## Core Commands

```bash
silo init              # Create silo.toml starter config
silo up [name]         # Start environment (allocates ports, creates k3d, starts Tilt)
silo down              # Stop Tilt (keeps k3d by default)
silo status            # Show current instance state and active profile
silo env [name]        # Generate env file only (don't start Tilt)
silo profiles          # List available profiles from silo.toml
silo doc [topic]       # Show bundled docs (see topics below)
silo version           # Show CLI version
silo help [command]    # Show help
```

## Key Flags

| Flag | Commands | Description |
|------|----------|-------------|
| `--profile <name>` / `-p` | up, env | Use named profile (overrides SILO_PROFILE env) |
| `--force` / `-f` | up | Regenerate ports or switch profiles |
| `--delete-cluster` | down | Delete k3d cluster (default: keep) |
| `--clean` | down | Remove env file and lockfile |
| `--config <path>` / `-c` | all | Custom config path (default: silo.toml) |
| `--verbose` / `-v` | all | Show detailed output |

## Profile Usage

Profiles allow environment-specific configuration (e.g., connecting to remote APIs):

```bash
# List available profiles
silo profiles

# Start with a profile
silo up --profile testnet

# Profile persists in lockfile - subsequent runs reuse it
silo up  # Automatically uses testnet from lockfile

# Switch profile (requires --force)
silo up --profile devnet --force

# Clear profile (use base config)
silo up --force

# Generate env with profile
silo env --profile testnet
```

Profile resolution order: `--profile` flag > `SILO_PROFILE` env var > lockfile profile > base config

## Generated Files

| File | Purpose |
|------|---------|
| `.localnet.env` | Environment variables for Tilt and services |
| `.silo.lock` | Instance state (name, ports, profile, k3d status) |

## Configuration (silo.toml)

```toml
version = 1

[ports]
WEB_PORT = 3000
API_PORT = 8080
TILT_PORT = 10350

[hosts]
APP_HOST = "${name}.localhost"
API_HOST = "api.${name}.localhost"

[urls]
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"
API_URL = "http://${API_HOST}:${API_PORT}"

[k3d]
enabled = true
args = ["--agents=1"]

[k3d.registry]
enabled = true

[hooks]
pre-up = ["./scripts/check-deps.sh"]
post-up = ["./scripts/seed-db.sh"]

[profiles.remote-api]
urls.API_URL = "https://api.staging.example.com"
k3d.enabled = false

[profiles.remote-api.append]
hooks.post-up = ["./scripts/configure-remote.sh"]
```

## Typical Workflow

```bash
# First time setup
cd my-tilt-project
silo init                    # Creates silo.toml
# Edit silo.toml for your ports/hosts/URLs
silo up                      # Auto-generates name, allocates ports, starts Tilt

# Daily development
silo up                      # Reuses existing instance from lockfile

# Multiple instances (e.g., different worktrees)
cd ../my-project-worktree
silo up feature-x            # Creates separate instance with isolated resources

# Remote API testing
silo up --profile remote-api # Uses external API instead of local k3d

# Cleanup
silo down                    # Stop Tilt, keep k3d
silo down --delete-cluster   # Full cleanup including k3d
```

## What NOT to Do

1. **Don't manually create k3d clusters** - silo manages them with proper naming
2. **Don't hardcode ports** - use the generated `.localnet.env` values
3. **Don't use `localhost:PORT`** - use `*.localhost` hostnames for cookie isolation
4. **Don't manually edit `.silo.lock`** - let silo manage it
5. **Don't switch profiles without `--force`** - prevents accidental config changes

## Integration with Tilt

In your Tiltfile, load the silo-generated env:

```python
load('ext://dotenv', 'dotenv')
dotenv('.localnet.env')

# Use env vars
web_port = os.getenv('WEB_PORT', '3000')
app_host = os.getenv('APP_HOST', 'localhost')
```

## Common Issues

**"Instance already running"**: Another Tilt process exists. Run `silo down` first.

**"Profile change requires --force"**: Add `--force` to switch profiles.

**"No lockfile found"**: Run `silo up` to create initial instance.

**Port conflicts**: silo auto-allocates from ephemeral range (49152-65535) when defaults are occupied.

## Bundled Documentation

Use `silo doc [topic]` to view detailed documentation:

| Topic | Description |
|-------|-------------|
| `config` | silo.toml reference (all fields, examples) |
| `profiles` | Profile configuration and override behavior |
| `commands` | CLI command reference |
| `lockfile` | Lockfile format and behavior |
| `interpolation` | Template variables and resolution phases |
| `ports` | Port allocation and validation rules |
| `k3d` | k3d cluster integration settings |
| `hooks` | Lifecycle hooks (pre-up, post-up, etc.) |

Example: `silo doc profiles` shows profile syntax, merge semantics, and switching behavior.

## Reference

- Full spec: See `SPEC.md` in project root
- Repository: https://github.com/0xBigBoss/silo
