# silo Specification

Isolated local development environments. Solves instance isolation and k3d bootstrap sequencing for Tilt-based projects.

## Problem Statement

Running multiple instances of the same project on localhost causes conflicts:

- **Port collisions**: Hardcoded ports (3000, 5432, 8080) fight for binding
- **Data corruption**: Shared Docker volumes cause cross-instance data bleed
- **Auth confusion**: Browser cookies/localStorage shared across `localhost:*` ports
- **Ambiguous resources**: Can't identify which containers/volumes belong to which instance
- **Bootstrap chicken-egg**: Tilt needs k3d cluster, but who creates it?

## Quick Start

**Minimal config** (`silo.toml`):
```toml
version = 1

[ports]
WEB_PORT = 3000
API_PORT = 8080
```

**Usage**:
```bash
silo up          # Generates name, allocates ports, starts Tilt
silo status      # Show current instance
silo down        # Stop Tilt
```

**Generated env** (`.localnet.env`):
```bash
WORKSPACE_NAME=myproject-a3f7
COMPOSE_PROJECT_NAME=localnet-myproject-a3f7
APP_HOST=myproject-a3f7.localhost
WEB_PORT=3000
API_PORT=8080
```

For k3d cluster support, add:
```toml
[k3d]
enabled = true

[k3d.registry]
enabled = true
```

## Solution Overview

silo coordinates the local dev environment lifecycle:

```
silo up <name>
         |
         v
+---------------------------+
| Validate tools exist      |
| (tilt, k3d if configured) |
+---------------------------+
         |
         v
+---------------------------+
| Generate instance identity|
| - COMPOSE_PROJECT_NAME    |
| - K3D_CLUSTER_NAME        |
| - APP_HOST (*.localhost)  |
+---------------------------+
         |
         v
+---------------------------+
| Allocate ports            |
| - Try defaults first      |
| - Fall back to ephemeral  |
+---------------------------+
         |
         v
+---------------------------+
| Write env file + lockfile |
+---------------------------+
         |
         v
+---------------------------+
| Create k3d cluster        |
| (if configured)           |
+---------------------------+
         |
         v
+---------------------------+
| Start Tilt (foreground)   |
| Ctrl+C stops everything   |
+---------------------------+
```

## CLI Interface

```
silo <command> [options]

Commands:
  up [name]       Start environment (creates k3d if needed, starts Tilt)
  down            Stop environment (stops Tilt, keeps k3d by default)
  status          Show current instance state
  env [name]      Generate env file only, don't start anything

Arguments:
  [name]          Instance name (e.g., main, feature-x, dev)
                  If omitted: reuses name from lockfile
                  If no lockfile: generates from directory + random suffix

Global Options:
  -c, --config    Path to config file (default: silo.toml)
  -h, --help      Show help

Command Options:
  up:
    -f, --force   Regenerate ports even if lockfile exists

  down:
    --delete-cluster   Delete k3d cluster (default: keep for faster iteration)
    --clean            Remove env file and lockfile

Examples:
  silo up dev                    # Start instance 'dev'
  silo up                        # Reuse last instance name
  silo env feature-x             # Generate env only
  silo down                      # Stop Tilt (keep k3d)
  silo down --delete-cluster     # Stop Tilt and delete k3d
  silo status                    # Show what's running
```

## Configuration Schema

Projects define their environment in `silo.toml`:

```toml
version = 1

# Optional fields with defaults:
prefix = "localnet"           # Resource naming prefix (default: 'localnet')
output = ".localnet.env"      # Output file location (default: '.localnet.env')

# Port definitions with defaults
# silo tries default first, allocates from ephemeral range if occupied
[ports]
POSTGRES_PORT = 5432
REDIS_PORT = 6379
API_PORT = 8080
WEB_PORT = 3000
ADMIN_PORT = 3001
TILT_PORT = 10350
K3D_REGISTRY_PORT = 5000  # Only used if k3d.registry.enabled

# Host definitions for browser isolation
# ${name} is replaced with instance name (e.g., "feature-x")
# Default if omitted: APP_HOST = "${name}.localhost"
[hosts]
APP_HOST = "${name}.localhost"
ADMIN_HOST = "admin.${name}.localhost"
API_HOST = "api.${name}.localhost"

# URL templates (optional) - shell-style ${VAR} interpolation
# Available vars: all ports, all hosts, WORKSPACE_NAME, etc.
[urls]
DATABASE_URL = "postgres://user:pass@localhost:${POSTGRES_PORT}/dev"
REDIS_URL = "redis://localhost:${REDIS_PORT}"
API_URL = "http://${API_HOST}:${API_PORT}"
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"
ADMIN_URL = "http://${ADMIN_HOST}:${ADMIN_PORT}"

# k3d cluster configuration (optional)
# If present, silo creates/deletes k3d cluster as part of lifecycle
[k3d]
enabled = true
# Full k3d passthrough - any k3d cluster create flags
args = [
  "--agents=2",
  "--port=8080:80@loadbalancer",
  "--port=8443:443@loadbalancer",
]

# Registry configuration (port allocated via ports.K3D_REGISTRY_PORT)
[k3d.registry]
enabled = true

# Lifecycle hooks (optional)
# Run shell commands at lifecycle points
[hooks]
pre-up = ["./scripts/check-deps.sh"]
post-up = ["./scripts/seed-db.sh", "./scripts/generate-certs.sh"]
pre-down = ["./scripts/backup-state.sh"]
post-down = []
```

## Core Types

```typescript
interface SiloConfig {
  version: 1;
  prefix?: string;                   // Default: 'localnet'
  output?: string;                   // Default: '.localnet.env'
  ports: Record<string, number>;     // Required: at least one port
  hosts?: Record<string, string>;    // Default: { APP_HOST: '${name}.localhost' }
  urls?: Record<string, string>;     // Optional: omit if no derived URLs needed
  k3d?: K3dConfig;
  hooks?: LifecycleHooks;
}

// Defaults applied at config load time
const CONFIG_DEFAULTS = {
  prefix: 'localnet',
  output: '.localnet.env',
  hosts: { APP_HOST: '${name}.localhost' },
  urls: {},
} as const;

interface K3dConfig {
  enabled: boolean;
  args?: string[];
  registry?: {
    enabled: boolean;
    // Port allocated via ports.K3D_REGISTRY_PORT (default: 5000)
  };
}

interface LifecycleHooks {
  'pre-up'?: string[];
  'post-up'?: string[];
  'pre-down'?: string[];
  'post-down'?: string[];
}

interface InstanceIdentity {
  name: string;                    // Sanitized workspace name
  prefix: string;                  // Resource prefix (e.g., localnet)
  composeName: string;             // Docker Compose project name
  dockerNetwork: string;           // Docker network name
  volumePrefix: string;            // Docker volume prefix
  containerPrefix: string;         // Container name prefix
  hosts: Record<string, string>;   // Resolved hosts including built-in TILT_HOST
  k3dClusterName?: string;         // K3d cluster name if k3d enabled
  k3dRegistryName?: string;        // K3d registry name if k3d enabled
  kubeconfigPath?: string;         // Path to kubeconfig for this instance
}

interface InstanceState {
  name: string;
  ports: Record<string, number>;
  identity: InstanceIdentity;
  createdAt: string;
  k3dClusterCreated: boolean;
  tiltPid?: number;           // Set when Tilt starts, cleared on clean exit
  tiltStartedAt?: string;     // ISO timestamp when Tilt was started
}

interface Lockfile {
  version: 1;
  generatedAt: string;
  instance: InstanceState;
}
```

## Output Files

### Environment File (configurable path, default: .localnet.env)

```bash
# Generated by silo
# Instance: feature-x
# Generated: 2024-01-15T10:30:00Z

# === Instance Identity ===
WORKSPACE_NAME=feature-x
COMPOSE_PROJECT_NAME=localnet-feature-x
DOCKER_NETWORK=localnet-feature-x
VOLUME_PREFIX=localnet-feature-x
CONTAINER_PREFIX=localnet-feature-x-

# === Hosts (browser isolation) ===
APP_HOST=feature-x.localhost
ADMIN_HOST=admin.feature-x.localhost
API_HOST=api.feature-x.localhost
TILT_HOST=feature-x.localhost

# === Allocated Ports ===
POSTGRES_PORT=5432
REDIS_PORT=6379
API_PORT=8080
WEB_PORT=3000
ADMIN_PORT=3001
TILT_PORT=10350
K3D_REGISTRY_PORT=5000

# === k3d (if enabled) ===
K3D_CLUSTER_NAME=localnet-feature-x
K3D_REGISTRY_NAME=localnet-feature-x-registry.localhost:5000
KUBECONFIG=/home/user/.kube/localnet-feature-x

# === Derived URLs ===
DATABASE_URL=postgres://user:pass@localhost:5432/dev
REDIS_URL=redis://localhost:6379
API_URL=http://api.feature-x.localhost:8080
WEB_URL=http://feature-x.localhost:3000
ADMIN_URL=http://admin.feature-x.localhost:3001
```

### Lockfile (.silo.lock)

```json
{
  "version": 1,
  "generatedAt": "2024-01-15T10:30:00Z",
  "instance": {
    "name": "feature-x",
    "ports": {
      "POSTGRES_PORT": 5432,
      "REDIS_PORT": 6379,
      "API_PORT": 8080,
      "WEB_PORT": 3000,
      "ADMIN_PORT": 3001,
      "TILT_PORT": 10350,
      "K3D_REGISTRY_PORT": 5000
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
        "ADMIN_HOST": "admin.feature-x.localhost",
        "API_HOST": "api.feature-x.localhost",
        "TILT_HOST": "feature-x.localhost"
      },
      "k3dClusterName": "localnet-feature-x",
      "k3dRegistryName": "localnet-feature-x-registry.localhost",
      "kubeconfigPath": "/home/user/.kube/localnet-feature-x"
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "k3dClusterCreated": true
  }
}
```

## Variable Interpolation

Variables use shell-style `${VAR}` syntax. Resolution happens in phases:

### Phase 1: Identity Variables (computed first)

These are derived from the instance name and config:

| Variable | Source | Example |
|----------|--------|---------|
| `${name}` | Sanitized instance name | `feature-x` |
| `${prefix}` | Config `prefix` or default | `localnet` |
| `${WORKSPACE_NAME}` | Same as `${name}` | `feature-x` |
| `${COMPOSE_PROJECT_NAME}` | `{prefix}-{name}` | `localnet-feature-x` |

### Phase 2: Hosts (can use identity variables)

Host templates can only reference identity variables:

```toml
[hosts]
APP_HOST = "${name}.localhost"           # OK: uses ${name}
ADMIN_HOST = "admin.${name}.localhost"   # OK: uses ${name}
# APP_HOST = "${WEB_PORT}.localhost"     # ERROR: ports not yet resolved
```

### Phase 3: Ports (allocated, no interpolation)

Ports are allocated from defaults or ephemeral range. No interpolation in port values.

### Phase 4: URLs (can use all variables)

URL templates can reference identity, hosts, and ports:

```toml
[urls]
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"           # OK: host + port
API_URL = "http://${name}.localhost:${API_PORT}"     # OK: identity + port
DATABASE_URL = "postgres://user:pass@localhost:${POSTGRES_PORT}/dev"  # OK
```

### Phase 5: k3d.args (can use all variables)

k3d arguments can reference identity, hosts, and ports:

```toml
[k3d]
enabled = true
args = [
  "--agents=1",
  "--port=${K3D_LB_HTTP_PORT}:80@loadbalancer",  # OK: uses allocated port
  "--port=${K3D_LB_HTTPS_PORT}:443@loadbalancer",
]
```

This allows k3d port mappings to use dynamically allocated ports.

### Available Variables Summary

| In `hosts` | In `urls` | In `k3d.args` |
|------------|-----------|---------------|
| `${name}` | `${name}` | `${name}` |
| `${prefix}` | `${prefix}` | `${prefix}` |
| | `${WORKSPACE_NAME}` | `${WORKSPACE_NAME}` |
| | `${COMPOSE_PROJECT_NAME}` | `${COMPOSE_PROJECT_NAME}` |
| | All `hosts.*` keys | All `hosts.*` keys |
| | All `ports.*` keys | All `ports.*` keys |

## Port Allocation Strategy

**Default-first**: Try the configured default port. Only allocate from ephemeral range (49152-65535) if the default is occupied.

### Allocation Algorithm

```
for each port_key in config.ports (in declaration order):
  if lockfile exists AND lockfile.ports[port_key] is free:
    use lockfile.ports[port_key]
  else if config.ports[port_key] (default) is free:
    use config.ports[port_key]
  else:
    allocate next free port from ephemeral range (49152-65535)

  mark allocated port as used (can't be reused for another key)
```

### Port Validation Rules

- **Duplicate defaults**: If two ports have the same default (e.g., both 8080), second one gets ephemeral
- **Invalid range**: Ports must be 1-65535; values outside this range are errors
- **Availability check**: TCP bind test with 100ms timeout (for CI compatibility)
- **IPv4 only**: Bind to `0.0.0.0` to avoid IPv6 dual-stack complications
- **Deterministic order**: Ports allocated in config declaration order for reproducibility

### Port Reuse from Lockfile

When lockfile exists and `--force` not specified:
1. Load ports from lockfile
2. Verify each port is still free
3. If any port is occupied, reallocate only that port (keep others stable)
4. Update lockfile with new allocation

## Lifecycle Operations

### `silo up [name]`

1. Load config from silo.toml
2. Validate required tools exist (tilt; k3d if configured)
3. Check if instance already running -> error with hint
4. Resolve instance name (CLI arg -> lockfile -> auto-generate)
5. Allocate ports
6. Generate env file
7. Write lockfile
8. Run `pre-up` hooks
9. If k3d configured:
   - Create k3d cluster with instance-specific name
   - Create registry if configured
   - Write kubeconfig to instance-specific path
10. Run `post-up` hooks
11. Start Tilt in foreground
    - Write `tiltPid` and `tiltStartedAt` to lockfile
12. On Ctrl+C or Tilt exit:
    - Clear `tiltPid` from lockfile (indicates clean shutdown)
    - Proceed to cleanup (if needed)

### `silo down`

1. Read lockfile for current instance
2. Run `pre-down` hooks
3. Stop Tilt if running
4. k3d cluster is **kept by default** (faster iteration)
   - Use `silo down --delete-cluster` to remove k3d cluster
5. Run `post-down` hooks
6. Env file and lockfile are kept (for `silo up` to reuse ports)
   - Use `silo down --clean` to remove them

### `silo status`

1. Read lockfile
2. Check if Tilt process running
3. Check if k3d cluster exists
4. Display summary:
   ```
   Instance: feature-x
   State: running
   Tilt: pid 12345
   k3d: localnet-feature-x (running)
   Ports:
     WEB_PORT: 3000
     API_PORT: 8080
   URLs:
     WEB_URL: http://feature-x.localhost:3000
   ```

### `silo env [name]`

1. Load config
2. Resolve instance name
3. Allocate ports
4. Generate env file
5. Write lockfile
6. Exit (don't start anything)

## Name Resolution

Instance names are resolved in order:

1. **Explicit CLI argument**: `silo up my-feature`
2. **Existing lockfile**: If `.silo.lock` exists, reuse its name
3. **Auto-generate**: `{directory}-{random}` (e.g., `myproject-a3f7`)

Auto-generation:
- Takes current directory basename
- Appends 4-character random suffix (lowercase alphanumeric)
- Sanitizes result (lowercase, alphanumeric + dashes, max 63 chars)

```typescript
function generateName(): string {
  const dir = basename(process.cwd());
  const suffix = randomString(4); // e.g., 'a3f7'
  return sanitizeName(`${dir}-${suffix}`);
}
```

This ensures:
- Zero-config first run (`silo up` just works)
- Stable name on subsequent runs (lockfile persists it)
- Uniqueness across multiple clones of same repo

## Lifecycle Hooks

Hooks run shell commands at lifecycle points:

```toml
[hooks]
pre-up = ["./scripts/check-deps.sh"]
post-up = ["./scripts/seed-db.sh"]
pre-down = ["./scripts/backup-state.sh"]
post-down = []
```

**Execution:**
- Commands run sequentially in order listed
- Working directory is project root (where silo.toml lives)
- Environment includes all generated variables (ports, identity, URLs)
- Hooks inherit silo's stdout/stderr

**Failure handling:**
- If a hook exits non-zero, silo stops and reports the failure
- `pre-up` failure: Abort before k3d created (env/lockfile already written, can be reused)
- `post-up` failure: k3d exists but Tilt not started (user runs `silo down` to clean up)
- `pre-down` failure: Abort teardown, all resources remain
- `post-down` failure: Log warning, continue (resources already removed)

**Hook order in lifecycle:**

```
silo up:
  1. Load config, resolve name
  2. Allocate ports, generate env
  3. Run pre-up hooks
  4. Create k3d cluster (if configured)
  5. Run post-up hooks
  6. Start Tilt (foreground)

silo down:
  1. Run pre-down hooks
  2. Stop Tilt
  3. Delete k3d cluster (if --delete-cluster)
  4. Run post-down hooks
  5. Clean files (if --clean)
```

## Error Handling

- **Fail fast, manual cleanup**: Stop on first error. User runs `silo down` to clean up.
- **Tool validation**: Check tilt/k3d exist before starting. Provide clear error if missing.
- **Port conflicts**: Log which ports conflicted, show allocated alternatives.

### Instance State Detection

**"Already running" detection** (checked in `silo up`):
1. Lockfile exists with `tiltPid` set
2. Process with that PID is still running
3. Process is actually Tilt (check process name)

If all three: error with "Instance '{name}' already running. Use `silo down` first."

**"External Tilt" detection**:
1. Check for any Tilt process in current directory (via `pgrep -f "tilt.*$(pwd)"`)
2. If found and not tracked in lockfile: error with "Tilt already running outside silo. Stop it first."

### Missing Lockfile Behavior

| Command | Lockfile Missing | Behavior |
|---------|-----------------|----------|
| `silo up` | OK | Auto-generates name, normal startup, creates lockfile |
| `silo up <name>` | OK | Uses provided name, normal startup, creates lockfile |
| `silo down` | Error | "No lockfile found. Nothing to stop." |
| `silo status` | OK | "No active instance. Run `silo up` to start." |
| `silo env` | OK | Auto-generates name, normal generation, creates lockfile |
| `silo env <name>` | OK | Uses provided name, normal generation, creates lockfile |

## k3d Integration

silo calls k3d directly (not ctlptl). Instance isolation includes:

- **Cluster name**: `{prefix}-{name}` (e.g., `localnet-feature-x`)
- **Registry**: `{prefix}-{name}-registry.localhost:{port}`
- **Kubeconfig**: Separate file per instance at `~/.kube/{prefix}-{name}`

Creation command (assembled from config + allocated ports):
```bash
k3d cluster create localnet-feature-x \
  --kubeconfig-update-default=false \
  --kubeconfig-switch-context=false \
  --registry-create localnet-feature-x-registry.localhost:5000 \
  --agents=2 \
  --port=8080:80@loadbalancer \
  --port=8443:443@loadbalancer

# Write kubeconfig
k3d kubeconfig get localnet-feature-x > ~/.kube/localnet-feature-x
```

Note: Registry port (`5000` above) comes from allocated `K3D_REGISTRY_PORT`.

Deletion:
```bash
k3d cluster delete localnet-feature-x
```

## Browser Isolation

Different ports on `localhost` share cookies. Solution: subdomain isolation.

```
http://main.localhost:3000      -> separate cookies
http://feature-x.localhost:3001 -> separate cookies
```

Chrome/Edge treat `*.localhost` as 127.0.0.1 automatically. No `/etc/hosts` needed.

### Host Configuration

Hosts are defined in `silo.toml` with `${name}` placeholder:

```toml
# Simple (single host)
[hosts]
APP_HOST = "${name}.localhost"

# Multi-service (separate cookies per service)
[hosts]
APP_HOST = "${name}.localhost"
ADMIN_HOST = "admin.${name}.localhost"
API_HOST = "api.${name}.localhost"
```

**Default** (if `[hosts]` omitted):
```toml
[hosts]
APP_HOST = "${name}.localhost"
```

**Built-in hosts** (always added to `hosts` record):
- `TILT_HOST`: Copies `APP_HOST` value (for Tilt UI access at `http://${TILT_HOST}:${TILT_PORT}`)

**Resolution**: `${name}` is replaced with the sanitized instance name.
- Instance: `feature-x` → `APP_HOST=feature-x.localhost`
- Instance: `feature-x` → `ADMIN_HOST=admin.feature-x.localhost`

All host variables are available for URL templates:
```toml
[urls]
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"
ADMIN_URL = "http://${ADMIN_HOST}:${ADMIN_PORT}"
```

## Tilt Integration

**Tiltfile location**: Expected in current directory. User runs `silo up` from project root.

**Environment passing**: silo does both:
1. Sources env file before running tilt (`source .localnet.env && tilt up`)
2. Writes env file that Tiltfile can read directly (`read_file('.localnet.env')`)

Projects can use either approach in their Tiltfile.

## Non-Goals

- **No remote deploys**: Local development only. No staging/prod.
- **No config generation**: silo doesn't generate Tiltfile or compose.yaml. Projects own those.
- **No secrets management**: No vault/secrets integration. Use direnv or similar.
- **No compose management**: Tilt manages compose via `docker_compose()`. silo only sets env vars.

## Success Criteria

1. **Two instances run simultaneously**: Two worktrees of the same project run without port/volume/auth conflicts
2. **Clean bootstrap**: `git clone && silo up dev` works without manual k3d/registry setup
3. **Isolation verified**: Different instances have:
   - Different ports (verified by env file)
   - Different k3d clusters (verified by `k3d cluster list`)
   - Different browser cookies (verified by `*.localhost` hostnames)

## Example Project

A runnable example lives in `example/` to demonstrate and verify silo features.

### Structure

```
example/
  silo.toml           # silo configuration
  Tiltfile            # Tilt orchestration (includes inline k8s manifests)
  docker-compose.yaml # Redis service definition
  web/
    server.ts         # Simple Bun web server
    Dockerfile        # Container build
  scripts/
    check-deps.sh     # pre-up hook: verify docker, k3d installed
    seed-data.sh      # post-up hook: insert test data
```

### Example Configuration

```toml
# example/silo.toml
version = 1
# prefix defaults to "localnet" - not overridden here to avoid
# double-naming with auto-generated names from directory

[ports]
WEB_PORT = 3000
API_PORT = 8080
REDIS_PORT = 6379
TILT_PORT = 10350
K3D_REGISTRY_PORT = 5000
K3D_LB_HTTP_PORT = 8880
K3D_LB_HTTPS_PORT = 8443

[hosts]
APP_HOST = "${name}.localhost"
API_HOST = "api.${name}.localhost"

[urls]
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"
API_URL = "http://${API_HOST}:${API_PORT}"
REDIS_URL = "redis://localhost:${REDIS_PORT}"

[k3d]
enabled = true
args = [
  "--agents=1",
  "--port=${K3D_LB_HTTP_PORT}:80@loadbalancer",
  "--port=${K3D_LB_HTTPS_PORT}:443@loadbalancer",
]

[k3d.registry]
enabled = true

[hooks]
pre-up = ["./scripts/check-deps.sh"]
post-up = ["./scripts/seed-data.sh"]
```

### Example Tiltfile

```python
# example/Tiltfile
load('ext://dotenv', 'dotenv')
dotenv('.localnet.env')

# Read env vars for registry and ports
registry = os.getenv('K3D_REGISTRY_NAME', 'localhost:5000')
web_port = os.getenv('WEB_PORT', '3000')
redis_port = os.getenv('REDIS_PORT', '6379')
app_host = os.getenv('APP_HOST', 'localhost')
workspace_name = os.getenv('WORKSPACE_NAME', 'unknown')

# Set default registry so Tilt rewrites image refs automatically
default_registry(registry)

# Redis via docker-compose (simpler for stateful services)
docker_compose('docker-compose.yaml')
dc_resource('redis', labels=['backend'])

# Web service via k8s (demonstrates k3d cluster usage)
docker_build(
  'web',  # Tilt prepends registry automatically via default_registry()
  './web',
  live_update=[
    sync('./web', '/app'),
  ]
)

# Apply k8s manifests with env var substitution
k8s_yaml(blob("""
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: web
          ports:
            - containerPort: 3000
          env:
            - name: REDIS_URL
              value: "redis://host.docker.internal:{}"
            - name: APP_HOST
              value: "{}"
            - name: WORKSPACE_NAME
              value: "{}"
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 3000
      targetPort: 3000
""".format(redis_port, app_host, workspace_name)))

k8s_resource(
  'web',
  port_forwards=['{}:3000'.format(web_port)],
  labels=['frontend'],
  resource_deps=['redis']
)
```

### Example docker-compose.yaml

```yaml
# example/docker-compose.yaml
# Redis runs via docker-compose (simpler for local stateful services)
services:
  redis:
    image: redis:7-alpine
    ports:
      - "${REDIS_PORT}:6379"
```

### Example Web Server

```typescript
// example/web/server.ts
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    const host = req.headers.get("host") || "unknown";

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", host });
    }

    if (url.pathname === "/") {
      return new Response(`
        <html>
          <body>
            <h1>silo Example</h1>
            <p>Host: ${host}</p>
            <p>Instance: ${process.env.WORKSPACE_NAME}</p>
            <p>Ports: WEB=${process.env.WEB_PORT}, API=${process.env.API_PORT}</p>
          </body>
        </html>
      `, { headers: { "Content-Type": "text/html" } });
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running on port ${server.port}`);
```

### Running the Example

```bash
cd example

# First run: generates name (example-a3f7), creates k3d cluster, starts Tilt
# Name: directory "example" + random suffix "a3f7" -> "example-a3f7"
# Cluster: prefix "localnet" + name -> "localnet-example-a3f7"
silo up
# Output:
#   Instance: example-a3f7
#   Creating k3d cluster 'localnet-example-a3f7'...
#   Creating registry 'localnet-example-a3f7-registry.localhost:5000'...
#   Writing kubeconfig to ~/.kube/localnet-example-a3f7
#   Starting Tilt...
# Opens Tilt UI at http://example-a3f7.localhost:10350

# In another terminal, verify k3d cluster exists
k3d cluster list
# NAME                     SERVERS   AGENTS   LOADBALANCER
# localnet-example-a3f7    1/1       1/1      true

# Verify registry exists
k3d registry list
# NAME                                          ROLE       CLUSTER
# localnet-example-a3f7-registry.localhost      registry   localnet-example-a3f7

# Verify pod is running in k3d cluster
KUBECONFIG=~/.kube/localnet-example-a3f7 kubectl get pods
# NAME                   READY   STATUS    RESTARTS   AGE
# web-5d4f8b7c9f-x2k4j   1/1     Running   0          30s

# Verify web service responds (via Tilt port-forward)
curl http://example-a3f7.localhost:3000/health
# {"status":"ok","host":"example-a3f7.localhost:3000"}

# Check status
silo status
# Instance: example-a3f7
# State: running
# Tilt: pid 12345
# k3d: localnet-example-a3f7 (running)
# Registry: localnet-example-a3f7-registry.localhost:5000
# Kubeconfig: ~/.kube/localnet-example-a3f7
# Ports:
#   WEB_PORT: 3000
#   API_PORT: 8080
#   REDIS_PORT: 6379
#   K3D_REGISTRY_PORT: 5000
#   K3D_LB_HTTP_PORT: 8880

# Stop Tilt but keep k3d cluster (faster restart)
silo down

# Restart - reuses existing k3d cluster
silo up
# Output: Reusing k3d cluster 'localnet-example-a3f7'

# Full cleanup including k3d cluster
silo down --delete-cluster
# Output:
#   Stopping Tilt...
#   Deleting k3d cluster 'localnet-example-a3f7'...
#   Done

# Run second instance (simulating another worktree)
silo up second
# Creates separate k3d cluster 'localnet-second'
# If port 5000 occupied: K3D_REGISTRY_PORT allocates to 49152
# Fully isolated from first instance
```

### Feature Verification Checklist

The example verifies these silo features:

| Feature | Verification |
|---------|--------------|
| **Port allocation** | `silo status` shows allocated ports match env file |
| **Name generation** | First `silo up` creates name from directory + suffix |
| **Name reuse** | Second `silo up` (no arg) reuses lockfile name |
| **Host isolation** | Browser at `http://{name}.localhost:3000` shows correct instance |
| **Env file** | `.localnet.env` contains all expected variables |
| **Lockfile** | `.silo.lock` persists instance state |
| **k3d cluster creation** | `k3d cluster list` shows instance-named cluster |
| **k3d registry** | `k3d registry list` shows instance-named registry |
| **Isolated kubeconfig** | `~/.kube/{prefix}-{name}` exists and works |
| **k8s pod running** | `kubectl get pods` shows web pod in Running state |
| **Registry push** | Tilt builds and pushes to instance registry |
| **k3d cluster reuse** | Second `silo up` reuses existing cluster |
| **k3d cluster delete** | `silo down --delete-cluster` removes cluster |
| **Pre-up hook** | `check-deps.sh` runs before k3d created |
| **Post-up hook** | `seed-data.sh` runs after k3d ready |
| **Tilt foreground** | Ctrl+C in silo stops Tilt cleanly |
| **Down command** | `silo down` stops Tilt, keeps k3d |
| **Down --clean** | `silo down --clean` removes env and lockfile |
| **Multiple instances** | Two instances have separate k3d clusters, registries, ports |

### Integration Test Script

```bash
#!/bin/bash
# example/test-silo.sh
# Automated verification of silo features

set -euo pipefail

cd "$(dirname "$0")"

INSTANCE_NAME="test-$$"  # Unique per run
CLUSTER_NAME="localnet-${INSTANCE_NAME}"  # prefix + name

cleanup() {
  echo "=== Cleanup ==="
  silo down --delete-cluster --clean 2>/dev/null || true
  rm -f .localnet.env .silo.lock
}
trap cleanup EXIT

echo "=== Test: Fresh start ==="
rm -f .localnet.env .silo.lock
silo env "$INSTANCE_NAME"
[ -f .localnet.env ] || (echo "FAIL: env file not created"; exit 1)
[ -f .silo.lock ] || (echo "FAIL: lockfile not created"; exit 1)
grep -q "WORKSPACE_NAME=${INSTANCE_NAME}" .localnet.env || (echo "FAIL: wrong name"; exit 1)
echo "PASS: Fresh start"

echo "=== Test: Name reuse ==="
rm -f .localnet.env
silo env
grep -q "WORKSPACE_NAME=${INSTANCE_NAME}" .localnet.env || (echo "FAIL: name not reused"; exit 1)
echo "PASS: Name reuse"

echo "=== Test: Port allocation ==="
grep -q "WEB_PORT=" .localnet.env || (echo "FAIL: WEB_PORT not set"; exit 1)
grep -q "API_PORT=" .localnet.env || (echo "FAIL: API_PORT not set"; exit 1)
grep -q "K3D_REGISTRY_PORT=" .localnet.env || (echo "FAIL: K3D_REGISTRY_PORT not set"; exit 1)
echo "PASS: Port allocation"

echo "=== Test: Host generation ==="
grep -q "APP_HOST=${INSTANCE_NAME}.localhost" .localnet.env || (echo "FAIL: APP_HOST wrong"; exit 1)
grep -q "API_HOST=api.${INSTANCE_NAME}.localhost" .localnet.env || (echo "FAIL: API_HOST wrong"; exit 1)
echo "PASS: Host generation"

echo "=== Test: URL interpolation ==="
grep -q "WEB_URL=http://${INSTANCE_NAME}.localhost:" .localnet.env || (echo "FAIL: WEB_URL wrong"; exit 1)
echo "PASS: URL interpolation"

echo "=== Test: k3d cluster creation ==="
# Start silo in background for k3d test
silo up "$INSTANCE_NAME" &
SILO_PID=$!
sleep 10  # Wait for k3d cluster to be created

k3d cluster list | grep -q "$CLUSTER_NAME" || (echo "FAIL: k3d cluster not created"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: k3d cluster creation"

echo "=== Test: k3d registry ==="
k3d registry list | grep -q "${CLUSTER_NAME}-registry" || (echo "FAIL: k3d registry not created"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: k3d registry"

echo "=== Test: Isolated kubeconfig ==="
KUBECONFIG_PATH=$(grep "KUBECONFIG=" .localnet.env | cut -d= -f2)
[ -f "$KUBECONFIG_PATH" ] || (echo "FAIL: kubeconfig not created"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: Isolated kubeconfig"

echo "=== Test: k8s pod running ==="
sleep 30  # Wait for pod to be ready
KUBECONFIG="$KUBECONFIG_PATH" kubectl get pods | grep -q "web.*Running" || (echo "FAIL: pod not running"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: k8s pod running"

echo "=== Test: Stop silo ==="
kill $SILO_PID 2>/dev/null || true
wait $SILO_PID 2>/dev/null || true

echo "=== Test: k3d cluster preserved after down ==="
k3d cluster list | grep -q "$CLUSTER_NAME" || (echo "FAIL: cluster deleted on regular down"; exit 1)
echo "PASS: k3d cluster preserved"

echo "=== Test: k3d cluster deletion ==="
silo down --delete-cluster
k3d cluster list | grep -q "$CLUSTER_NAME" && (echo "FAIL: cluster not deleted"; exit 1)
echo "PASS: k3d cluster deletion"

echo "=== Test: --clean removes env and lockfile ==="
# Recreate files first
silo env "$INSTANCE_NAME"
[ -f .localnet.env ] || (echo "FAIL: env file not recreated"; exit 1)
[ -f .silo.lock ] || (echo "FAIL: lockfile not recreated"; exit 1)
# Now test --clean
silo down --clean
[ -f .localnet.env ] && (echo "FAIL: env file not removed by --clean"; exit 1)
[ -f .silo.lock ] && (echo "FAIL: lockfile not removed by --clean"; exit 1)
echo "PASS: --clean removes env and lockfile"

echo "All tests passed!"
```

## Decisions Log

All design decisions were made through interview. Key choices:

**Tech Stack:**
- **Runtime**: Bun (latest stable)
- **Config format**: TOML (`silo.toml`)
- **Distribution**: Bun single-file executable
- **Tooling**: oxlint, oxformat, knip, jscpd, lefthook

**Architecture:**
- **Port allocation**: Default-first (try configured port, fall back to ephemeral)
- **k3d registry port**: Allocated like other ports via `ports.K3D_REGISTRY_PORT`
- **Lifecycle scope**: Includes up/down/status/env commands
- **Tilt required**: silo assumes Tilt; compose-only projects use docker-compose directly
- **Compose handling**: Tilt manages compose via `docker_compose()`, silo doesn't touch it
- **k3d method**: Call k3d directly, not ctlptl
- **k3d on down**: Keep by default, `--delete-cluster` to remove
- **Config defaults**: `prefix`, `output`, `hosts`, `urls` all optional with sensible defaults
- **Template syntax**: Shell-style `${VAR}` with phased resolution (identity → hosts → ports → urls)
- **Name resolution**: CLI arg -> lockfile -> auto-generate (directory + random suffix)
- **Tilt process**: Foreground, Ctrl+C stops; tiltPid tracked in lockfile
- **Error handling**: Fail fast, manual cleanup; explicit missing lockfile behavior
- **Extensibility**: Lifecycle hooks (pre/post up/down)

## Tech Stack

### Runtime & Language

- **Runtime**: Bun (latest stable)
- **Language**: TypeScript (strict mode)
- **Distribution**: Bun single-file executable via `bun build --compile`

### Bun APIs Used

| Purpose | API | Notes |
|---------|-----|-------|
| File I/O | `Bun.file()`, `Bun.write()` | Read/write config, env, lockfile |
| Process spawn | `Bun.spawn()`, `Bun.spawnSync()` | Run k3d, tilt, hooks |
| Port check | `Bun.listen()` | TCP bind test for port availability |
| CLI args | `process.argv`, `Bun.argv` | Argument parsing |
| Signals | `process.on('SIGINT')` | Handle Ctrl+C |
| Shell | `Bun.$` (shell API) | Run hook scripts |
| Environment | `process.env` | Read/set env vars |

### Configuration Format

**TOML** (not YAML) for configuration files:
- File: `silo.toml`
- Parser: `@iarna/toml` or Bun-native if available

### Development Tooling

| Tool | Purpose | Config File |
|------|---------|-------------|
| **oxlint** | Linting (fast, Rust-based) | `oxlintrc.json` |
| **oxformat** | Formatting (companion to oxlint) | Via oxlint config |
| **knip** | Dead code/dependency detection | `knip.json` |
| **jscpd** | Copy-paste detection | `.jscpd.json` |
| **lefthook** | Git hooks (pre-commit, pre-push) | `lefthook.yml` |

### Build & Distribution

```bash
# Development
bun run dev           # Run with watch mode
bun run lint          # oxlint
bun run format        # oxformat
bun run check         # knip + jscpd

# Build single-file executable
bun build --compile --minify --outfile dist/silo src/cli.ts

# Cross-platform builds
bun build --compile --target=linux-x64 --outfile dist/silo-linux-x64 src/cli.ts
bun build --compile --target=darwin-arm64 --outfile dist/silo-darwin-arm64 src/cli.ts
bun build --compile --target=darwin-x64 --outfile dist/silo-darwin-x64 src/cli.ts
```

### Lefthook Configuration

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx}"
      run: bunx oxlint {staged_files}
    format:
      glob: "*.{ts,tsx,json,toml}"
      run: bunx oxformat --check {staged_files}
    typecheck:
      run: bun run tsc --noEmit

pre-push:
  commands:
    test:
      run: bun test
    knip:
      run: bunx knip
    jscpd:
      run: bunx jscpd src/
```

## CLI Architecture

### Directory Structure

```
src/
  cli.ts              # Entry point, argument parsing
  commands/
    up.ts             # silo up implementation
    down.ts           # silo down implementation
    status.ts         # silo status implementation
    env.ts            # silo env implementation
  core/
    config.ts         # Load and validate silo.toml
    name.ts           # Name resolution
    identity.ts       # Generate instance identity
    ports.ts          # Port allocation
    hosts.ts          # Host template resolution
    env.ts            # Generate env file content
    lockfile.ts       # Read/write lockfile
  backends/
    k3d.ts            # k3d cluster create/delete
    tilt.ts           # Start tilt, handle signals
  hooks/
    runner.ts         # Execute lifecycle hooks
  utils/
    validate.ts       # Check required tools exist
    logger.ts         # Structured logging
    errors.ts         # Error types and handling
```

### CLI Entry Point Pattern

```typescript
// src/cli.ts
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    config: { type: "string", short: "c", default: "silo.toml" },
    force: { type: "boolean", short: "f", default: false },
    help: { type: "boolean", short: "h", default: false },
    "delete-cluster": { type: "boolean", default: false },
    clean: { type: "boolean", default: false },
  },
  allowPositionals: true,
  strict: true,
});

const [command, ...args] = positionals;

switch (command) {
  case "up":
    await import("./commands/up").then(m => m.up(args[0], values));
    break;
  case "down":
    await import("./commands/down").then(m => m.down(values));
    break;
  case "status":
    await import("./commands/status").then(m => m.status(values));
    break;
  case "env":
    await import("./commands/env").then(m => m.env(args[0], values));
    break;
  default:
    printHelp();
}
```

### Port Check with Bun

```typescript
// src/core/ports.ts
async function isPortFree(port: number): Promise<boolean> {
  try {
    const server = Bun.listen({
      hostname: "0.0.0.0",
      port,
      socket: {
        data() {},
      },
    });
    server.stop();
    return true;
  } catch {
    return false;
  }
}
```

### Process Spawning Pattern

```typescript
// src/backends/tilt.ts
import { $ } from "bun";

async function startTilt(envFile: string): Promise<Bun.Subprocess> {
  // Source env and run tilt
  const proc = Bun.spawn(["tilt", "up"], {
    cwd: process.cwd(),
    env: { ...process.env, ...loadEnvFile(envFile) },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  return proc;
}

// For hooks, use shell API
async function runHook(script: string, env: Record<string, string>): Promise<void> {
  const result = await $`${script}`.env(env).quiet();
  if (result.exitCode !== 0) {
    throw new Error(`Hook failed: ${script}`);
  }
}
```

## References

- Prior art: `~/dotfiles/claude-code/.claude/skills/gen-env/`
- Bun docs: https://bun.sh/docs
- Tilt: https://tilt.dev
- k3d: https://k3d.io
- Browser localhost subdomain behavior: Built into Chromium
