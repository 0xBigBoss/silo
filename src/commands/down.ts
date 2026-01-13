import { loadConfig } from "../core/config";
import { resolveEnvPath } from "../core/env";
import { readLockfile, updateLockfile } from "../core/lockfile";
import { logger } from "../utils/logger";
import { promises as fs } from "fs";
import { runHooks } from "../hooks/runner";
import { deleteCluster } from "../backends/k3d";
import { tiltDown } from "../backends/tilt";
import { buildTemplateVars } from "../core/variables";
import { resolveTemplateRecord } from "../core/instance";
import { buildEnvVars } from "../core/env";
import { isPidRunning, isTiltProcess, stopProcess } from "../utils/process";
import { SiloError } from "../utils/errors";
import { ensureToolsAvailable } from "../utils/validate";

export const down = async (options: {
  config: string;
  "delete-cluster": boolean;
  clean: boolean;
}): Promise<void> => {
  logger.info("Loading config");
  const config = await loadConfig(options.config);
  logger.verbose(`Config path: ${config.configPath}`);
  const lockfile = await readLockfile(config.projectRoot);
  if (!lockfile) {
    throw new SiloError("No lockfile found. Nothing to stop.", "LOCKFILE_MISSING");
  }

  const templateVars = buildTemplateVars({
    identity: lockfile.instance.identity,
    ports: lockfile.instance.ports,
  });
  const urls = resolveTemplateRecord(config.urls, config.urlOrder, templateVars);
  const envVars = buildEnvVars(lockfile.instance, urls);

  logger.info(`Running pre-down hooks (${config.hooks["pre-down"]?.length ?? 0})`);
  await runHooks({
    hooks: config.hooks["pre-down"],
    env: envVars,
    cwd: config.projectRoot,
    phase: "pre-down",
  });

  try {
    await ensureToolsAvailable(["tilt"]);
    logger.info("Running tilt down");
    await tiltDown({ cwd: config.projectRoot, env: envVars });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`tilt down failed: ${message}`);
  }

  const tiltPid = lockfile.instance.tiltPid;
  if (tiltPid && isPidRunning(tiltPid)) {
    const tiltRunning = await isTiltProcess(tiltPid);
    if (tiltRunning) {
      logger.info(`Stopping Tilt (pid ${tiltPid})`);
      await stopProcess(tiltPid);
      logger.info("Stopped Tilt");
    }
  }

  if (lockfile.instance.tiltPid || lockfile.instance.tiltStartedAt) {
    await updateLockfile(config.projectRoot, (current) => {
      const { tiltPid: _tiltPid, tiltStartedAt: _tiltStartedAt, ...rest } =
        current.instance;
      return rest;
    });
  }

  if (options["delete-cluster"] && lockfile.instance.identity.k3dClusterName) {
    logger.info(`Deleting k3d cluster '${lockfile.instance.identity.k3dClusterName}'`);
    await deleteCluster(lockfile.instance.identity.k3dClusterName, config.projectRoot);
    await updateLockfile(config.projectRoot, (current) => ({
      ...current.instance,
      k3dClusterCreated: false,
    }));
  }

  try {
    logger.info(`Running post-down hooks (${config.hooks["post-down"]?.length ?? 0})`);
    await runHooks({
      hooks: config.hooks["post-down"],
      env: envVars,
      cwd: config.projectRoot,
      phase: "post-down",
    });
  } catch (error) {
    logger.warn(`post-down hook failed: ${(error as Error).message}`);
  }

  if (options.clean) {
    logger.info("Removing env file and lockfile");
    const envPath = resolveEnvPath(config);
    await fs.rm(envPath, { force: true });
    await fs.rm(`${config.projectRoot}/.silo.lock`, { force: true });
  }
};
