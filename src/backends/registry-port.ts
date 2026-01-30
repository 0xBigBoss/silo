import {
  DOCKER_PORT_TIMEOUT_MS,
  DOCKER_PS_TIMEOUT_MS,
  K3D_LIST_TIMEOUT_MS,
  REGISTRY_RESOLVE_RETRY_BASE_DELAY_MS,
  REGISTRY_RESOLVE_RETRY_COUNT,
  REGISTRY_RESOLVE_RETRY_MAX_DELAY_MS,
} from "../core/constants";
import { SiloError } from "../utils/errors";
import { runCommand } from "../utils/exec";
import { withRetry } from "../utils/retry";

const isPortInRange = (port: number): boolean => port >= 1 && port <= 65535;

const parseDockerPortOutput = (output: string): number | null => {
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const match = /:(\d+)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const port = Number.parseInt(match[1]!, 10);
    if (Number.isInteger(port) && isPortInRange(port)) {
      return port;
    }
  }

  return null;
};

const selectRegistryContainer = (
  names: string[],
  registryHost: string
): string | null => {
  const exact = names.find((name) => name === registryHost);
  if (exact) {
    return exact;
  }

  const prefixed = names.find((name) => name === `k3d-${registryHost}`);
  if (prefixed) {
    return prefixed;
  }

  const suffixMatches = names.filter((name) => name.endsWith(registryHost));
  if (suffixMatches.length === 1) {
    return suffixMatches[0]!;
  }

  if (names.length === 1) {
    return names[0]!;
  }

  return null;
};

const resolveRegistryContainerName = async (
  registryHost: string,
  cwd: string
): Promise<string> => {
  const result = await runCommand(
    ["docker", "ps", "--filter", `name=${registryHost}`, "--format", "{{.Names}}"],
    {
      cwd,
      timeoutMs: DOCKER_PS_TIMEOUT_MS,
      context: "docker ps (registry lookup)",
      stdio: "pipe",
    }
  );

  if (result.exitCode !== 0) {
    throw new SiloError(
      `Failed to list docker containers for registry '${registryHost}'`,
      "REGISTRY_CONTAINER_LIST_FAILED"
    );
  }

  const names = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (names.length === 0) {
    throw new SiloError(
      `Registry container not found for '${registryHost}'`,
      "REGISTRY_CONTAINER_MISSING"
    );
  }

  const selected = selectRegistryContainer(names, registryHost);
  if (!selected) {
    throw new SiloError(
      `Multiple registry containers matched '${registryHost}': ${names.join(", ")}`,
      "REGISTRY_CONTAINER_AMBIGUOUS"
    );
  }

  return selected;
};

type K3dRegistryEntry = {
  name?: string;
  portMappings?: Record<string, Array<{ HostPort?: string }>>;
};

const selectRegistryEntry = (entries: K3dRegistryEntry[], registryHost: string): K3dRegistryEntry | null => {
  const exact = entries.find((entry) => entry.name === registryHost);
  if (exact) {
    return exact;
  }

  const suffixMatches = entries.filter(
    (entry) => entry.name && entry.name.endsWith(registryHost)
  );
  if (suffixMatches.length === 1) {
    return suffixMatches[0] ?? null;
  }

  if (entries.length === 1) {
    return entries[0] ?? null;
  }

  return null;
};

const parseK3dRegistryHostPort = (entry: K3dRegistryEntry): number | null => {
  const mappings = entry.portMappings?.["5000/tcp"];
  if (!mappings || mappings.length === 0) {
    return null;
  }

  for (const mapping of mappings) {
    const raw = mapping.HostPort;
    if (!raw) {
      continue;
    }
    const port = Number.parseInt(raw, 10);
    if (Number.isInteger(port) && isPortInRange(port)) {
      return port;
    }
  }

  return null;
};

const resolveRegistryHostPortFromK3d = async (params: {
  registryHost: string;
  cwd: string;
}): Promise<number> => {
  const { registryHost, cwd } = params;
  const result = await runCommand(["k3d", "registry", "list", "-o", "json"], {
    cwd,
    timeoutMs: K3D_LIST_TIMEOUT_MS,
    context: "k3d registry list",
    stdio: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new SiloError(
      `Failed to list k3d registries for '${registryHost}'`,
      "REGISTRY_PORT_FAILED"
    );
  }

  let entries: K3dRegistryEntry[];
  try {
    entries = JSON.parse(result.stdout) as K3dRegistryEntry[];
  } catch (error) {
    throw new SiloError(
      `Failed to parse k3d registry list output: ${error instanceof Error ? error.message : String(error)}`,
      "REGISTRY_PORT_INVALID"
    );
  }

  const selected = selectRegistryEntry(entries, registryHost);
  if (!selected) {
    throw new SiloError(
      `Registry entry not found for '${registryHost}'`,
      "REGISTRY_PORT_INVALID"
    );
  }

  const port = parseK3dRegistryHostPort(selected);
  if (!port) {
    throw new SiloError(
      `Unable to parse registry port for '${registryHost}'`,
      "REGISTRY_PORT_INVALID"
    );
  }

  return port;
};

const resolveRegistryHostPortFromDocker = async (params: {
  registryHost: string;
  cwd: string;
}): Promise<number> => {
  const { registryHost, cwd } = params;
  const containerName = await resolveRegistryContainerName(registryHost, cwd);
  const result = await runCommand(["docker", "port", containerName, "5000"], {
    cwd,
    timeoutMs: DOCKER_PORT_TIMEOUT_MS,
    context: `docker port ${containerName} 5000`,
    stdio: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new SiloError(
      `Failed to resolve registry port for '${registryHost}'`,
      "REGISTRY_PORT_FAILED"
    );
  }

  const port = parseDockerPortOutput(result.stdout);
  if (!port) {
    throw new SiloError(
      `Unable to parse registry port for '${registryHost}'`,
      "REGISTRY_PORT_INVALID"
    );
  }

  return port;
};

export const resolveRegistryHostPort = async (params: {
  registryName: string;
  cwd: string;
}): Promise<number> => {
  const { registryName, cwd } = params;
  const registryHost = registryName.split(":")[0] ?? registryName;

  return await withRetry(
    async () => {
      try {
        return await resolveRegistryHostPortFromK3d({ registryHost, cwd });
      } catch (error) {
        if (error instanceof SiloError) {
          return await resolveRegistryHostPortFromDocker({ registryHost, cwd });
        }
        throw error;
      }
    },
    {
      attempts: REGISTRY_RESOLVE_RETRY_COUNT,
      baseDelayMs: REGISTRY_RESOLVE_RETRY_BASE_DELAY_MS,
      maxDelayMs: REGISTRY_RESOLVE_RETRY_MAX_DELAY_MS,
    }
  );
};
