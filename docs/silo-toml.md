# silo.toml Reference

This document is the canonical reference for configuring silo. It is bundled
with the CLI and can be printed with:

```
silo doc config
```

## Minimal Example

```toml
version = 1

[ports]
WEB_PORT = 3000
API_PORT = 8080
```

## Full Example

```toml
version = 1

# Optional fields with defaults:
prefix = "localnet"           # Resource naming prefix (default: "localnet")
output = ".localnet.env"      # Output file location (default: ".localnet.env")

[ports]
POSTGRES_PORT = 5432
REDIS_PORT = 6379
API_PORT = 8080
WEB_PORT = 3000
ADMIN_PORT = 3001
TILT_PORT = 10350
K3D_REGISTRY_PORT = 5000  # Only used if k3d.registry.enabled

[hosts]
APP_HOST = "${name}.localhost"
ADMIN_HOST = "admin.${name}.localhost"
API_HOST = "api.${name}.localhost"

[urls]
DATABASE_URL = "postgres://user:pass@localhost:${POSTGRES_PORT}/dev"
REDIS_URL = "redis://localhost:${REDIS_PORT}"
API_URL = "http://${API_HOST}:${API_PORT}"
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"
ADMIN_URL = "http://${ADMIN_HOST}:${ADMIN_PORT}"

[k3d]
enabled = true
args = [
  "--agents=2",
  "--port=8080:80@loadbalancer",
  "--port=8443:443@loadbalancer",
]

[k3d.registry]
enabled = true

[hooks]
pre-up = ["./scripts/check-deps.sh"]
post-up = ["./scripts/seed-db.sh", "./scripts/generate-certs.sh"]
pre-down = ["./scripts/backup-state.sh"]
post-down = []
```

## Top-Level Fields

- `version` (required): Must be `1`.
- `prefix` (optional): Resource naming prefix. Default: `localnet`.
- `output` (optional): Env file path. Default: `.localnet.env`.
- `ports` (required): Map of port names to default values (at least one entry).
- `hosts` (optional): Hostname templates. Default: `APP_HOST = "${name}.localhost"`.
- `urls` (optional): URL templates. Default: empty.
- `k3d` (optional): k3d cluster integration settings.
- `hooks` (optional): Lifecycle hook commands.

## Ports

Ports are allocated in declaration order. For each port key:

1. If a lockfile exists and that port is free, it is reused.
2. Otherwise, the configured default is tried.
3. If occupied, the next free ephemeral port (49152-65535) is allocated.

Rules:
- Ports must be within 1-65535.
- Duplicate defaults are allowed; the first gets the default, the second gets an ephemeral port.

## Hosts

Hosts are used for browser isolation. Templates can only reference identity variables.

```toml
[hosts]
APP_HOST = "${name}.localhost"
API_HOST = "api.${name}.localhost"
```

Defaults:
- If `hosts` is omitted, `APP_HOST = "${name}.localhost"` is added.
- `TILT_HOST` is always added and copies `APP_HOST`.

## URLs

URL templates can reference identity, hosts, and ports:

```toml
[urls]
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"
API_URL = "http://${name}.localhost:${API_PORT}"
```

## k3d

Enable k3d integration to create/delete a cluster as part of `silo up/down`.

```toml
[k3d]
enabled = true
args = [
  "--agents=2",
  "--port=8080:80@loadbalancer",
]

[k3d.registry]
enabled = true
```

Notes:
- Registry port is allocated via `ports.K3D_REGISTRY_PORT` (default: 5000).
- `k3d.args` can use interpolation variables (see below).

## Hooks

Hooks run shell commands at lifecycle points:

```toml
[hooks]
pre-up = ["./scripts/check-deps.sh"]
post-up = ["./scripts/seed-db.sh"]
pre-down = ["./scripts/backup-state.sh"]
post-down = []
```

Hooks inherit all generated env vars (ports, hosts, URLs, etc).

## Interpolation

Templates use `${VAR}` syntax. Resolution happens in phases:

1. Identity variables (`name`, `prefix`, `WORKSPACE_NAME`, `COMPOSE_PROJECT_NAME`)
2. Hosts (can reference identity only)
3. Ports (allocated, no interpolation)
4. URLs (can reference identity, hosts, ports)
5. `k3d.args` (can reference identity, hosts, ports)

### Available Variables Summary

| In `hosts`  | In `urls`                 | In `k3d.args`             |
| ----------- | ------------------------- | ------------------------- |
| `${name}`   | `${name}`                 | `${name}`                 |
| `${prefix}` | `${prefix}`               | `${prefix}`               |
|             | `${WORKSPACE_NAME}`       | `${WORKSPACE_NAME}`       |
|             | `${COMPOSE_PROJECT_NAME}` | `${COMPOSE_PROJECT_NAME}` |
|             | All `hosts.*` keys        | All `hosts.*` keys        |
|             | All `ports.*` keys        | All `ports.*` keys        |

## Generated Env Vars

silo writes an env file that includes:
- Identity: `WORKSPACE_NAME`, `COMPOSE_PROJECT_NAME`, `DOCKER_NETWORK`, `VOLUME_PREFIX`, `CONTAINER_PREFIX`
- Hosts: `APP_HOST`, `API_HOST`, `TILT_HOST`, etc
- Ports: all entries from `[ports]`
- k3d: `K3D_CLUSTER_NAME`, `K3D_REGISTRY_NAME`, `KUBECONFIG` (if enabled)
- URLs: all entries from `[urls]`
