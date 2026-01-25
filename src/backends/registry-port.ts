import { DOCKER_PORT_TIMEOUT_MS, DOCKER_PS_TIMEOUT_MS } from "../core/constants";
import { SiloError } from "../utils/errors";
import { runCommand } from "../utils/exec";

const isPortInRange = (port: number): boolean => port >= 1 && port <= 65535;

export const parseDockerPortOutput = (output: string): number | null => {
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

export const resolveRegistryHostPort = async (params: {
  registryName: string;
  cwd: string;
}): Promise<number> => {
  const { registryName, cwd } = params;
  const registryHost = registryName.split(":")[0] ?? registryName;
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
