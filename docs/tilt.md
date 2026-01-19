# Tilt Integration

This document describes how silo interacts with Tilt. It is bundled with the
CLI and can be printed with:

```
silo doc tilt
```

## Expectations

- A `Tiltfile` is expected in the current directory.
- `tilt` must be installed and on your PATH.

## Startup

`silo up` starts Tilt in the foreground with:

```
tilt up
```

silo passes all generated env vars to Tilt. The process runs in the same
terminal, and `Ctrl+C` stops Tilt.

## Shutdown

`silo down` runs `tilt down` (with a timeout) and then stops any tracked Tilt
PID if still running.

## Env File Usage

silo writes an env file and also exports the same vars when running Tilt. Your
Tiltfile can read the file directly (for example with a dotenv extension) or
use the process environment.
