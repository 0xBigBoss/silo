# silo

Isolated local development environments. silo solves instance isolation and k3d bootstrap sequencing for Tilt-based projects.

## Requirements

- Bun (runtime)
- Tilt
- k3d (optional, only if `k3d.enabled = true`)

## Install

```bash
npm i -g @0xbigboss/silo
```

## Quick start

```bash
silo init
# edit silo.toml
silo up dev
```

Print the bundled `silo.toml` reference:

```bash
silo doc config
```

## Commands

```bash
silo init            # Create silo.toml starter config
silo up [name]       # Start environment (creates k3d if needed, starts Tilt)
silo down            # Stop environment (stops Tilt, keeps k3d by default)
silo status          # Show current instance state
silo env [name]      # Generate env file only, don't start anything
silo doc config      # Print silo.toml reference
```

## Configuration

`silo.toml` defines ports, hosts, URLs, k3d settings, and hooks. For the canonical reference, run:

```bash
silo doc config
```

You can also browse `SPEC.md` for a detailed specification.

## License

MIT
