# Logging

This document describes silo's logging behavior. It is bundled with the CLI and
can be printed with:

```
silo doc logging
```

## Default Logs

By default, silo logs:

- Major lifecycle steps (config load, name resolution, port allocation, hooks)
- Actions taken (env/lockfile written, cluster created/reused, Tilt started)
- Summaries (ports/URLs for `silo env`, status summary for `silo status`)

## Verbose Mode

Use `-v` or `--verbose` to include extra details, such as:

- The config path being used
- Port reuse decisions and lockfile reuse
