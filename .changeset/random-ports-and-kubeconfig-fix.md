---
"@0xbigboss/silo": minor
---

Add support for `random` or `0` port values to always allocate from the ephemeral range (49152-65535), while still reusing lockfile ports across restarts.

Fix kubeconfig corruption when k3d outputs debug lines with ANSI escape sequences to stdout.
