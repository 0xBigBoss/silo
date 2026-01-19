# Interpolation

This document describes template interpolation for `silo.toml`. It is bundled
with the CLI and can be printed with:

```
silo doc interpolation
```

## Syntax

Templates use `${VAR}` syntax.

## Resolution Phases

Interpolation happens in phases to keep dependencies predictable:

1. **Identity**: `name`, `prefix`, `WORKSPACE_NAME`, `COMPOSE_PROJECT_NAME`
2. **Hosts**: can reference identity only
3. **Ports**: allocated values, no interpolation in port numbers
4. **URLs**: can reference identity, hosts, and ports
5. **k3d.args**: can reference identity, hosts, ports, and URLs

## Variables by Section

| In `hosts`  | In `urls`                 | In `k3d.args`             |
| ----------- | ------------------------- | ------------------------- |
| `${name}`   | `${name}`                 | `${name}`                 |
| `${prefix}` | `${prefix}`               | `${prefix}`               |
|             | `${WORKSPACE_NAME}`       | `${WORKSPACE_NAME}`       |
|             | `${COMPOSE_PROJECT_NAME}` | `${COMPOSE_PROJECT_NAME}` |
|             | All `hosts.*` keys        | All `hosts.*` keys        |
|             | All `ports.*` keys        | All `ports.*` keys        |
|             | All `urls.*` keys         | All `urls.*` keys         |

If k3d is enabled, the following variables are also available after identity
creation:

- `K3D_CLUSTER_NAME`
- `K3D_REGISTRY_NAME` (only when registry is enabled)
- `KUBECONFIG`

## Example

```toml
[hosts]
APP_HOST = "${name}.localhost"

[ports]
WEB_PORT = 3000

[urls]
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"

[k3d]
enabled = true
args = [
  "--port=${WEB_PORT}:80@loadbalancer",
]
```
