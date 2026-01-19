# Lockfile (.silo.lock)

This document describes the lockfile that silo writes to track the active
instance state. It is bundled with the CLI and can be printed with:

```
silo doc lockfile
```

## Location

The lockfile is written to the project root as `.silo.lock`.

## When It Is Written

- `silo up` writes the lockfile before starting hooks and Tilt.
- `silo env` writes the lockfile and exits.
- `silo down --clean` removes the lockfile.

## Purpose

The lockfile allows silo to:

- Reuse the instance name on subsequent runs
- Reuse allocated ports (unless `--force` is used)
- Remember the active profile
- Track Tilt PID and start time
- Track k3d identity and whether a cluster was created

## Format

The lockfile is JSON with this shape:

```json
{
  "version": 1,
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "instance": {
    "name": "feature-x",
    "profile": "testnet",
    "ports": {
      "WEB_PORT": 3000,
      "API_PORT": 8080
    },
    "identity": {
      "name": "feature-x",
      "prefix": "localnet",
      "composeName": "localnet-feature-x",
      "dockerNetwork": "localnet-feature-x",
      "volumePrefix": "localnet-feature-x",
      "containerPrefix": "localnet-feature-x-",
      "hosts": {
        "APP_HOST": "feature-x.localhost",
        "TILT_HOST": "feature-x.localhost"
      },
      "k3dClusterName": "localnet-feature-x",
      "k3dRegistryName": "localnet-feature-x-registry.localhost:5000",
      "kubeconfigPath": "/home/user/.kube/localnet-feature-x"
    },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "k3dClusterCreated": true,
    "tiltPid": 12345,
    "tiltStartedAt": "2026-01-01T00:00:05.000Z"
  }
}
```

Notes:

- `profile`, `k3dClusterName`, `k3dRegistryName`, `kubeconfigPath`, `tiltPid`,
  and `tiltStartedAt` are omitted when not applicable.
- `k3dRegistryName` is only present when `k3d.registry.enabled = true`.

## Editing

The lockfile is intended to be machine-managed. If you want to reset state,
remove `.silo.lock` (and the env file if desired) and run `silo up` again.
