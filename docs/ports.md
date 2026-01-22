# Port Allocation

This document describes how silo allocates ports. It is bundled with the CLI
and can be printed with:

```
silo doc ports
```

## Requirements

- `ports` must define at least one entry.
- Port values must be integers between 1 and 65535, or `random`/`0` to always
  allocate from the ephemeral range.

## Allocation Strategy

Ports are allocated in declaration order. For each port key:

1. If a lockfile exists and that port is free, reuse it (unless `--force`).
2. If the configured value is `random`/`0`, skip defaults and allocate from the
   ephemeral range (49152-65535).
3. Otherwise, try the configured default. If occupied, allocate the next free
   port from the ephemeral range (49152-65535).

Ports are unique per instance. If two keys share the same default value, the
first one wins and the next one will fall back to an ephemeral port.

## Availability Check

silo checks whether a port is free by attempting to bind to `0.0.0.0` with a
100ms timeout. This keeps checks fast and CI-friendly.

## Force Behavior

`--force` ignores the lockfile's stored ports and allocates fresh values using
the normal default-first strategy.

## k3d Registry Port

When `k3d.registry.enabled = true`, you must define `K3D_REGISTRY_PORT` in
`[ports]` so silo can create the registry and advertise it to the cluster.
