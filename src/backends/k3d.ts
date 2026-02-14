import path from "path";
import { promises as fs } from "fs";
import {
  DOCKER_PS_TIMEOUT_MS,
  K3D_CREATE_TIMEOUT_MS,
  K3D_DELETE_TIMEOUT_MS,
  K3D_LIST_TIMEOUT_MS,
} from "../core/constants";
import { runCommand, runCommandChecked } from "../utils/exec";
import { SiloError } from "../utils/errors";

type RegistryHealth = "healthy" | "stale" | "unknown";

export type EnsureClusterDeps = {
  runCommand: typeof runCommand;
  runCommandChecked: typeof runCommandChecked;
};

const defaultEnsureClusterDeps: EnsureClusterDeps = {
  runCommand,
  runCommandChecked,
};

const parseNamesOutput = (output: string): string[] =>
  output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const parseRegistryListNames = (output: string): string[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const name = (entry as { name?: unknown }).name;
      return typeof name === "string" && name.length > 0 ? name : null;
    })
    .filter((name): name is string => name !== null);
};

const hasRegistryEntry = (registryNames: string[], registryHost: string): boolean => {
  if (registryNames.includes(registryHost)) {
    return true;
  }
  return registryNames.some((name) => name.endsWith(registryHost));
};

const hasRegistryContainer = (containerNames: string[], registryHost: string): boolean => {
  const prefixedName = `k3d-${registryHost}`;
  return containerNames.some(
    (name) => name === registryHost || name === prefixedName || name.endsWith(registryHost)
  );
};

const resolveRegistryHealth = async (
  registryName: string,
  cwd: string,
  deps: EnsureClusterDeps
): Promise<RegistryHealth> => {
  const registryHost = registryName.split(":")[0] ?? registryName;

  const registryList = await deps.runCommand(["k3d", "registry", "list", "-o", "json"], {
    cwd,
    timeoutMs: K3D_LIST_TIMEOUT_MS,
    context: "k3d registry list",
    stdio: "pipe",
  });
  if (registryList.exitCode !== 0) {
    return "unknown";
  }

  const registryNames = parseRegistryListNames(registryList.stdout);
  if (!registryNames) {
    return "unknown";
  }
  if (!hasRegistryEntry(registryNames, registryHost)) {
    return "stale";
  }

  const dockerContainers = await deps.runCommand(
    ["docker", "ps", "--filter", `name=${registryHost}`, "--format", "{{.Names}}"],
    {
      cwd,
      timeoutMs: DOCKER_PS_TIMEOUT_MS,
      context: "docker ps (registry health check)",
      stdio: "pipe",
    }
  );
  if (dockerContainers.exitCode !== 0) {
    return "unknown";
  }

  const containerNames = parseNamesOutput(dockerContainers.stdout);
  return hasRegistryContainer(containerNames, registryHost) ? "healthy" : "stale";
};

export const clusterExists = async (
  clusterName: string,
  cwd: string,
  runner: typeof runCommand = runCommand
): Promise<boolean> => {
  const result = await runner(["k3d", "cluster", "list"], {
    cwd,
    timeoutMs: K3D_LIST_TIMEOUT_MS,
    context: "k3d cluster list",
    stdio: "pipe",
  });

  if (result.exitCode !== 0) {
    return false;
  }

  return result.stdout.includes(clusterName);
};

export const ensureCluster = async (params: {
  clusterName: string;
  registryName: string | undefined;
  args: string[];
  cwd: string;
}, deps: EnsureClusterDeps = defaultEnsureClusterDeps): Promise<{ created: boolean }> => {
  const { clusterName, registryName, args, cwd } = params;
  const exists = await clusterExists(clusterName, cwd, deps.runCommand);
  if (exists) {
    if (!registryName) {
      return { created: false };
    }

    const registryHealth = await resolveRegistryHealth(registryName, cwd, deps);
    if (registryHealth !== "stale") {
      return { created: false };
    }

    await deps.runCommandChecked(["k3d", "cluster", "delete", clusterName], {
      cwd,
      timeoutMs: K3D_DELETE_TIMEOUT_MS,
      context: `k3d cluster delete ${clusterName}`,
      stdio: "inherit",
    });
  }

  const cmd = [
    "k3d",
    "cluster",
    "create",
    clusterName,
    "--kubeconfig-update-default=false",
    "--kubeconfig-switch-context=false",
  ];

  if (registryName) {
    cmd.push("--registry-create", registryName);
  }

  cmd.push(...args);

  await deps.runCommandChecked(cmd, {
    cwd,
    timeoutMs: K3D_CREATE_TIMEOUT_MS,
    context: `k3d cluster create ${clusterName}`,
    stdio: "inherit",
  });

  return { created: true };
};

export const deleteCluster = async (clusterName: string, cwd: string): Promise<void> => {
  await runCommandChecked(["k3d", "cluster", "delete", clusterName], {
    cwd,
    timeoutMs: K3D_DELETE_TIMEOUT_MS,
    context: `k3d cluster delete ${clusterName}`,
    stdio: "inherit",
  });
};

/**
 * Strips ANSI escape sequences and debug output lines from k3d output.
 * k3d may write debug lines (e.g., DEBU[0000]) to stdout with ANSI colors.
 */
export const stripDebugOutput = (output: string): string => {
  // ANSI escape sequence pattern: ESC[ followed by parameters and command
  // No 'g' flag - we only need to detect presence, not find all matches
  // oxlint-disable-next-line no-control-regex -- intentionally matching ANSI escapes
  const ansiPattern = /\x1b\[[0-9;]*[a-zA-Z]/;

  return output
    .split("\n")
    .filter((line) => {
      // Skip lines containing ANSI escape sequences
      if (ansiPattern.test(line)) {
        return false;
      }
      // Skip debug/info/warn log lines (DEBU, INFO, WARN patterns from logrus)
      if (/^(DEBU|INFO|WARN|ERRO)\[/.test(line)) {
        return false;
      }
      return true;
    })
    .join("\n");
};

export const writeKubeconfig = async (
  clusterName: string,
  kubeconfigPath: string,
  cwd: string
): Promise<void> => {
  const result = await runCommand(["k3d", "kubeconfig", "get", clusterName], {
    cwd,
    timeoutMs: K3D_LIST_TIMEOUT_MS,
    context: `k3d kubeconfig get ${clusterName}`,
    stdio: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new SiloError("Failed to fetch kubeconfig", "KUBECONFIG_FAILED");
  }

  const dir = path.dirname(kubeconfigPath);
  await fs.mkdir(dir, { recursive: true });

  const cleanYaml = stripDebugOutput(result.stdout);
  await Bun.write(kubeconfigPath, cleanYaml);
};
