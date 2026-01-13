import path from "path";
import { promises as fs } from "fs";
import {
  K3D_CREATE_TIMEOUT_MS,
  K3D_DELETE_TIMEOUT_MS,
  K3D_LIST_TIMEOUT_MS,
} from "../core/constants";
import { runCommand, runCommandChecked } from "../utils/exec";
import { SiloError } from "../utils/errors";

export const clusterExists = async (clusterName: string, cwd: string): Promise<boolean> => {
  const result = await runCommand(["k3d", "cluster", "list"], {
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
}): Promise<{ created: boolean }> => {
  const { clusterName, registryName, args, cwd } = params;
  const exists = await clusterExists(clusterName, cwd);
  if (exists) {
    return { created: false };
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

  await runCommandChecked(cmd, {
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

  await Bun.write(kubeconfigPath, result.stdout);
};
