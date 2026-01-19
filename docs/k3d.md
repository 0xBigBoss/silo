# k3d Integration

This document describes the optional k3d integration. It is bundled with the
CLI and can be printed with:

```
silo doc k3d
```

## Enable k3d

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

If the registry is enabled, define `K3D_REGISTRY_PORT` in `[ports]`.

## Naming and Paths

silo derives names from `{prefix}-{name}`:

- Cluster name: `{prefix}-{name}`
- Registry name: `{prefix}-{name}-registry.localhost:{K3D_REGISTRY_PORT}`
- Kubeconfig path: `~/.kube/{prefix}-{name}`

## Lifecycle Behavior

- `silo up` creates the cluster if missing, otherwise reuses it.
- `silo down` keeps the cluster by default.
- `silo down --delete-cluster` deletes it.

## k3d.args Interpolation

Arguments in `k3d.args` are interpolated after ports and URLs resolve, so they
can reference identity, hosts, ports, and URLs.

## Registry Advertising

When `k3d.registry.enabled = true`, silo advertises the registry using the
standard `local-registry-hosting` ConfigMap in the `kube-public` namespace. This
allows Tilt to auto-discover the registry without `default_registry()`.

## Tool Requirements

- `k3d` is required when k3d is enabled.
- `kubectl` is required when the registry is enabled.
