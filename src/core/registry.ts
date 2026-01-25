import { buildInstanceIdentity } from "./identity";
import { resolveTemplateRecord } from "./instance";
import { buildTemplateVars } from "./variables";
import type { InstanceState, ResolvedConfig } from "./types";
import { SiloError } from "../utils/errors";

export const applyRegistryPortOverride = (params: {
  state: InstanceState;
  config: ResolvedConfig;
  actualPort: number;
}): { changed: boolean; state: InstanceState; urls: Record<string, string> } => {
  const { state, config, actualPort } = params;
  const currentPort = state.ports.K3D_REGISTRY_PORT;

  if (!currentPort) {
    throw new SiloError(
      "K3D_REGISTRY_PORT missing for registry reconciliation",
      "INVALID_STATE"
    );
  }

  if (currentPort === actualPort) {
    const templateVars = buildTemplateVars({ identity: state.identity, ports: state.ports });
    const urls = resolveTemplateRecord(config.urls, config.urlOrder, templateVars);
    return { changed: false, state, urls };
  }

  const updatedPorts = { ...state.ports, K3D_REGISTRY_PORT: actualPort };
  const updatedIdentity = buildInstanceIdentity({
    name: state.identity.name,
    prefix: state.identity.prefix,
    hosts: state.identity.hosts,
    ports: updatedPorts,
    k3dEnabled: config.k3d?.enabled ?? false,
    registryEnabled: config.k3d?.registry?.enabled ?? false,
  });

  const templateVars = buildTemplateVars({
    identity: updatedIdentity,
    ports: updatedPorts,
  });
  const urls = resolveTemplateRecord(config.urls, config.urlOrder, templateVars);

  const updatedState: InstanceState = {
    ...state,
    ports: updatedPorts,
    identity: updatedIdentity,
  };

  return { changed: true, state: updatedState, urls };
};
