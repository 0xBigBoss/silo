import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { KUBECTL_APPLY_TIMEOUT_MS } from "../core/constants";
import { runCommandChecked } from "../utils/exec";

const buildConfigMap = (
  host: string,
  hostFromContainerRuntime?: string,
  hostFromClusterNetwork?: string
): string => {
  const hostLine = `    host: "${host}"`;
  const runtimeLine = hostFromContainerRuntime
    ? `\n    hostFromContainerRuntime: "${hostFromContainerRuntime}"`
    : "";
  const clusterLine = hostFromClusterNetwork
    ? `\n    hostFromClusterNetwork: "${hostFromClusterNetwork}"`
    : "";
  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
${hostLine}${runtimeLine}${clusterLine}
`;
};

export const advertiseLocalRegistry = async (params: {
  registryHost: string;
  registryHostFromContainerRuntime?: string;
  registryHostFromClusterNetwork?: string;
  kubeconfigPath: string;
  cwd: string;
}): Promise<void> => {
  const {
    registryHost,
    registryHostFromContainerRuntime,
    registryHostFromClusterNetwork,
    kubeconfigPath,
    cwd,
  } = params;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "silo-registry-"));
  const manifestPath = path.join(tmpDir, "local-registry-hosting.yaml");
  try {
    await fs.writeFile(
      manifestPath,
      buildConfigMap(
        registryHost,
        registryHostFromContainerRuntime,
        registryHostFromClusterNetwork
      ),
      "utf-8"
    );
    await runCommandChecked(["kubectl", "apply", "-f", manifestPath], {
      cwd,
      env: { KUBECONFIG: kubeconfigPath },
      timeoutMs: KUBECTL_APPLY_TIMEOUT_MS,
      context: "kubectl apply local-registry-hosting",
      stdio: "inherit",
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};
