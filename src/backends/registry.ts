import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { KUBECTL_APPLY_TIMEOUT_MS, KUBECTL_GET_TIMEOUT_MS } from "../core/constants";
import { runCommand, runCommandChecked } from "../utils/exec";
import { withRetry } from "../utils/retry";

const buildConfigMap = (
  host: string,
  hostFromContainerRuntime?: string,
  hostFromClusterNetwork?: string,
  help?: string
): string => {
  const hostLine = `    host: "${host}"`;
  const runtimeLine = hostFromContainerRuntime
    ? `\n    hostFromContainerRuntime: "${hostFromContainerRuntime}"`
    : "";
  const clusterLine = hostFromClusterNetwork
    ? `\n    hostFromClusterNetwork: "${hostFromClusterNetwork}"`
    : "";
  const helpLine = help ? `\n    help: "${help}"` : "";
  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
${hostLine}${runtimeLine}${clusterLine}${helpLine}
`;
};

export const advertiseLocalRegistry = async (params: {
  registryHost: string;
  registryHostFromContainerRuntime?: string;
  registryHostFromClusterNetwork?: string;
  help?: string;
  kubeconfigPath?: string;
  cwd: string;
  retry: {
    attempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
}): Promise<void> => {
  const {
    registryHost,
    registryHostFromContainerRuntime,
    registryHostFromClusterNetwork,
    help,
    kubeconfigPath,
    cwd,
    retry,
  } = params;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "silo-registry-"));
  const manifestPath = path.join(tmpDir, "local-registry-hosting.yaml");
  try {
    await fs.writeFile(
      manifestPath,
      buildConfigMap(
        registryHost,
        registryHostFromContainerRuntime,
        registryHostFromClusterNetwork,
        help
      ),
      "utf-8"
    );
    await withRetry(
      () =>
        runCommandChecked(["kubectl", "apply", "-f", manifestPath], {
          cwd,
          ...(kubeconfigPath ? { env: { KUBECONFIG: kubeconfigPath } } : {}),
          timeoutMs: KUBECTL_APPLY_TIMEOUT_MS,
          context: "kubectl apply local-registry-hosting",
          stdio: "inherit",
        }),
      retry
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};

export const getRegistryConfigMapStatus = async (params: {
  kubeconfigPath?: string;
  cwd: string;
}): Promise<"present" | "absent" | "unknown"> => {
  const { kubeconfigPath, cwd } = params;
  const result = await runCommand(
    [
      "kubectl",
      "get",
      "configmap",
      "local-registry-hosting",
      "-n",
      "kube-public",
      "-o",
      "json",
    ],
    {
      cwd,
      ...(kubeconfigPath ? { env: { KUBECONFIG: kubeconfigPath } } : {}),
      timeoutMs: KUBECTL_GET_TIMEOUT_MS,
      context: "kubectl get local-registry-hosting",
      stdio: "pipe",
    }
  );

  if (result.exitCode === 0) {
    return "present";
  }

  const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
  if (combined.includes("notfound") || combined.includes("not found")) {
    return "absent";
  }

  return "unknown";
};
