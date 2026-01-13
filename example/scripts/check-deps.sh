#!/bin/bash
set -euo pipefail

command -v docker >/dev/null 2>&1
command -v k3d >/dev/null 2>&1
command -v tilt >/dev/null 2>&1
