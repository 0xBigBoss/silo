import type { InstanceIdentity } from "./types";

export const buildIdentityEnvVars = (identity: InstanceIdentity): Record<string, string> => ({
  WORKSPACE_NAME: identity.name,
  COMPOSE_PROJECT_NAME: identity.composeName,
  DOCKER_NETWORK: identity.dockerNetwork,
  VOLUME_PREFIX: identity.volumePrefix,
  CONTAINER_PREFIX: identity.containerPrefix,
});

export const buildTemplateVars = (params: {
  identity: InstanceIdentity;
  ports: Record<string, number>;
  urls?: Record<string, string>;
}): Record<string, string | number> => {
  const { identity, ports, urls } = params;
  const base = {
    name: identity.name,
    prefix: identity.prefix,
    ...buildIdentityEnvVars(identity),
    ...identity.hosts,
    ...ports,
    ...(identity.k3dClusterName ? { K3D_CLUSTER_NAME: identity.k3dClusterName } : {}),
    ...(identity.k3dRegistryName ? { K3D_REGISTRY_NAME: identity.k3dRegistryName } : {}),
    ...(identity.kubeconfigPath ? { KUBECONFIG: identity.kubeconfigPath } : {}),
  };

  return urls ? { ...base, ...urls } : base;
};
