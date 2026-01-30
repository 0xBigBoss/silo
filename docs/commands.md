# CLI Commands

This document is the canonical reference for silo's CLI commands. It is bundled
with the CLI and can be printed with:

```
silo doc commands
```

## Global Options

Most commands accept:

- `-c, --config` Path to config file (default: `silo.toml`)
- `-v, --verbose` Enable verbose logging
- `-h, --help` Show help

## help

```
silo help [command]
```

Shows global help or per-command help.

## init

```
silo init
```

Creates a starter `silo.toml` in the current directory. Fails if the file
already exists.

## doc

```
silo doc [topic]
```

Prints bundled documentation as raw markdown. If no topic is provided, silo
prints the available topics.

Topics currently include:

- `config`
- `profiles`
- `commands`
- `lockfile`
- `interpolation`
- `ports`
- `hosts`
- `urls`
- `k3d`
- `hooks`
- `logging`
- `troubleshooting`
- `tilt`

Options:

- `--list` Print topic keys (one per line)
- `--json` Print topics as JSON

## up

```
silo up [name]
```

Starts an environment (creates k3d if configured, starts Tilt). If `name` is
omitted, silo reuses the name from the lockfile or generates a new one.

Options:

- `-f, --force` Regenerate ports even if lockfile exists
- `-p, --profile` Use named profile (overrides `SILO_PROFILE`)

Notes:

- Switching profiles on an existing instance requires `--force`.
- Tool validation runs before startup (`tilt`, plus `k3d`/`kubectl` if needed).

## down

```
silo down
```

Stops Tilt and runs down hooks. By default, k3d clusters are kept for faster
restarts.

Options:

- `--delete-cluster` Delete the k3d cluster
- `--clean` Remove env file and lockfile

## status

```
silo status
```

Shows the current instance state (profile, Tilt, k3d, ports, URLs) based on the
lockfile.

## env

```
silo env [name]
```

Generates env and lockfile only; does not start k3d or Tilt. Accepts the same
profile and force options as `silo up`.

Options:

- `-f, --force` Regenerate ports even if lockfile exists
- `-p, --profile` Use named profile (overrides `SILO_PROFILE`)
- `--export-ci` Export env vars to `$GITHUB_ENV` (auto in CI)

## ci

```
silo ci [name] [-- <tilt args>]
```

Runs the full silo startup sequence for CI (env, hooks, k3d) and executes
`tilt ci` instead of `tilt up`.

Options:

- `-f, --force` Regenerate ports even if lockfile exists
- `-p, --profile` Use named profile (overrides `SILO_PROFILE`)
- `--timeout` Passed through to `tilt ci --timeout`
- `--export-ci` Export env vars to `$GITHUB_ENV` (auto in CI)
- `--` Pass remaining args to `tilt ci`

## profiles

```
silo profiles
```

Lists profiles defined in `silo.toml`, or prints "No profiles defined" if none.

## version

```
silo version
```

Prints the current CLI version in the format `silo vX.Y.Z`.

## Behavioral Guarantees

- Lockfile reuse: if `.silo.lock` exists and ports are free, silo reuses them
  unless `--force` is used.
- Profile switching: changing profiles on an existing instance requires
  `--force`.
- Port allocation order: ports are allocated in declaration order with
  default-first, then ephemeral fallback (use `random`/`0` to skip defaults).
