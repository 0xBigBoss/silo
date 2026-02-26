---
"@0xbigboss/silo": patch
---

Validate k3d registry `hostFrom*` advertisement overrides against the resolved
shortened/hash-based k3d registry identity to prevent unreachable hostnames and
`ImagePullBackOff` during local image pulls.
