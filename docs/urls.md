# URLs

This document describes URL templates and derived variables. It is bundled with
the CLI and can be printed with:

```
silo doc urls
```

## Configuration

```toml
[urls]
WEB_URL = "http://${APP_HOST}:${WEB_PORT}"
API_URL = "http://${API_HOST}:${API_PORT}"
```

## Interpolation Rules

URL templates can reference:

- Identity vars (`name`, `prefix`, `WORKSPACE_NAME`, `COMPOSE_PROJECT_NAME`)
- All `hosts.*` keys
- All `ports.*` keys

URLs are resolved after hosts and ports, so they always use allocated port
values.

## Output

Resolved URLs are written to the env file and are available to hooks and Tilt.
