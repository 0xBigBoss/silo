#!/bin/bash
# Automated verification of silo features

set -euo pipefail

SILO_BIN="${SILO_BIN:-silo}"

cd "$(dirname "$0")"

INSTANCE_NAME="test-$$"  # Unique per run
CLUSTER_NAME="localnet-${INSTANCE_NAME}"  # prefix + name

cleanup() {
  echo "=== Cleanup ==="
  $SILO_BIN down --delete-cluster --clean 2>/dev/null || true
  rm -f .localnet.env .silo.lock
}
trap cleanup EXIT

echo "=== Test: Fresh start ==="
rm -f .localnet.env .silo.lock
$SILO_BIN env "$INSTANCE_NAME"
[ -f .localnet.env ] || (echo "FAIL: env file not created"; exit 1)
[ -f .silo.lock ] || (echo "FAIL: lockfile not created"; exit 1)
grep -q "WORKSPACE_NAME=${INSTANCE_NAME}" .localnet.env || (echo "FAIL: wrong name"; exit 1)
echo "PASS: Fresh start"

echo "=== Test: Name reuse ==="
rm -f .localnet.env
$SILO_BIN env
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
$SILO_BIN up "$INSTANCE_NAME" &
SILO_PID=$!

wait_for() {
  local description=$1
  local timeout=$2
  local command=$3
  local interval=2
  local elapsed=0
  while [ $elapsed -lt $timeout ]; do
    if eval "$command"; then
      return 0
    fi
    sleep $interval
    elapsed=$((elapsed + interval))
  done
  echo "FAIL: timeout waiting for ${description}"
  return 1
}

wait_for "k3d cluster" 60 "k3d cluster list | grep -q \"$CLUSTER_NAME\"" || (kill $SILO_PID 2>/dev/null; exit 1)

k3d cluster list | grep -q "$CLUSTER_NAME" || (echo "FAIL: k3d cluster not created"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: k3d cluster creation"

echo "=== Test: k3d registry ==="
k3d registry list | grep -q "${CLUSTER_NAME}-registry" || (echo "FAIL: k3d registry not created"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: k3d registry"

echo "=== Test: Isolated kubeconfig ==="
KUBECONFIG_PATH=$(grep "KUBECONFIG=" .localnet.env | cut -d= -f2)
wait_for "kubeconfig file" 60 "test -f \"$KUBECONFIG_PATH\"" || (echo "FAIL: kubeconfig not created"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: Isolated kubeconfig"

echo "=== Test: k8s pods running ==="
wait_for "web pod running" 120 "KUBECONFIG=\"$KUBECONFIG_PATH\" kubectl get pods | grep -q \"web.*Running\"" || (echo "FAIL: web pod not running"; kill $SILO_PID 2>/dev/null; exit 1)
wait_for "api pod running" 120 "KUBECONFIG=\"$KUBECONFIG_PATH\" kubectl get pods | grep -q \"api.*Running\"" || (echo "FAIL: api pod not running"; kill $SILO_PID 2>/dev/null; exit 1)
echo "PASS: k8s pods running"

echo "=== Test: Stop silo ==="
kill $SILO_PID 2>/dev/null || true
wait $SILO_PID 2>/dev/null || true

echo "=== Test: k3d cluster preserved after down ==="
k3d cluster list | grep -q "$CLUSTER_NAME" || (echo "FAIL: cluster deleted on regular down"; exit 1)
echo "PASS: k3d cluster preserved"

echo "=== Test: k3d cluster deletion ==="
$SILO_BIN down --delete-cluster
k3d cluster list | grep -q "$CLUSTER_NAME" && (echo "FAIL: cluster not deleted"; exit 1)
echo "PASS: k3d cluster deletion"

echo "=== Test: --clean removes env and lockfile ==="
# Recreate files first
$SILO_BIN env "$INSTANCE_NAME"
[ -f .localnet.env ] || (echo "FAIL: env file not recreated"; exit 1)
[ -f .silo.lock ] || (echo "FAIL: lockfile not recreated"; exit 1)
# Now test --clean
$SILO_BIN down --clean
[ -f .localnet.env ] && (echo "FAIL: env file not removed by --clean"; exit 1)
[ -f .silo.lock ] && (echo "FAIL: lockfile not removed by --clean"; exit 1)
echo "PASS: --clean removes env and lockfile"

echo "All tests passed!"
