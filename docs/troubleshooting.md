# Troubleshooting

This document lists common errors and fixes. It is bundled with the CLI and can
be printed with:

```
silo doc troubleshooting
```

## Config File Not Found

**Error:** `Config file not found`

- Ensure `silo.toml` exists in the current directory, or pass `--config`.

## No Lockfile Found

**Error:** `No lockfile found. Nothing to stop.`

- Run `silo up` first, or remove `--clean` if you intended to keep state.

## Instance Already Running

**Error:** `Instance '<name>' already running. Use 'silo down' first.`

- Run `silo down`, or stop the Tilt process and try again.

## Tilt Already Running Outside silo

**Error:** `Tilt already running outside silo. Stop it first.`

- Stop the external Tilt process in this directory and retry.

## Profile Switch Requires --force

**Error:** `Profile change requires --force (current: X, requested: Y)`

- Re-run with `--force` when switching profiles:
  `silo up --profile <name> --force`

## Unknown or Missing Profile

**Error:** `Unknown profile: <name>` or `No profiles defined in config`

- Check `[profiles]` in `silo.toml`, or remove `--profile`.

## Missing Tools

**Error:** `tilt` or `k3d` not found

- Ensure required tools are installed and on your PATH.
