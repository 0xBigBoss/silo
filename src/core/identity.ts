import path from "path";
import os from "os";
import type { IdentityVars, InstanceIdentity } from "./types";
import { shortenK3dClusterName } from "./name";
import { SiloError } from "../utils/errors";

export const buildIdentityVars = (name: string, prefix: string): IdentityVars => ({
  name,
  prefix,
  WORKSPACE_NAME: name,
  COMPOSE_PROJECT_NAME: `${prefix}-${name}`,
});

export const buildInstanceIdentity = (params: {
  name: string;
  prefix: string;
  hosts: Record<string, string>;
  ports: Record<string, number>;
  k3dEnabled: boolean;
  registryEnabled: boolean;
}): InstanceIdentity => {
  const { name, prefix, hosts, ports, k3dEnabled, registryEnabled } = params;
  const composeName = `${prefix}-${name}`;
  const k3dClusterName = k3dEnabled ? shortenK3dClusterName(composeName) : undefined;
  const kubeconfigPath = k3dClusterName
    ? path.join(os.homedir(), ".kube", k3dClusterName)
    : undefined;

  let k3dRegistryName: string | undefined;
  if (k3dEnabled && registryEnabled && k3dClusterName) {
    const registryPort = ports.K3D_REGISTRY_PORT;
    if (!registryPort) {
      throw new SiloError(
        "K3D_REGISTRY_PORT must be defined in ports when registry is enabled",
        "INVALID_CONFIG"
      );
    }
    k3dRegistryName = `${k3dClusterName}-registry.localhost:${registryPort}`;
  }

  const identity: InstanceIdentity = {
    name,
    prefix,
    composeName,
    dockerNetwork: composeName,
    volumePrefix: composeName,
    containerPrefix: `${composeName}-`,
    hosts,
  };

  if (k3dEnabled) {
    identity.k3dClusterName = k3dClusterName;
    if (kubeconfigPath) {
      identity.kubeconfigPath = kubeconfigPath;
    }
  }

  if (k3dRegistryName) {
    identity.k3dRegistryName = k3dRegistryName;
  }

  return identity;
};
