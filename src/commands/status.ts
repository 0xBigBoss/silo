import path from "path";
import { loadConfig } from "../core/config";
import { readLockfile } from "../core/lockfile";
import { buildTemplateVars } from "../core/variables";
import { resolveTemplateRecord } from "../core/instance";
import { clusterExists } from "../backends/k3d";
import { isPidRunning, isTiltProcess } from "../utils/process";
import { logger } from "../utils/logger";

export const status = async (options: { config: string }): Promise<void> => {
  const resolvedConfigPath = path.resolve(process.cwd(), options.config);
  const configFile = Bun.file(resolvedConfigPath);
  const hasConfig = await configFile.exists();
  const config = hasConfig ? await loadConfig(options.config) : null;
  if (config) {
    logger.verbose(`Config path: ${config.configPath}`);
  }
  const projectRoot = config?.projectRoot ?? process.cwd();

  const lockfile = await readLockfile(projectRoot);
  if (!lockfile) {
    logger.info("No active instance. Run 'silo up' to start.");
    return;
  }

  const tiltPid = lockfile.instance.tiltPid;
  const tiltRunning = tiltPid
    ? isPidRunning(tiltPid) && (await isTiltProcess(tiltPid))
    : false;

  const clusterName = lockfile.instance.identity.k3dClusterName;
  const k3dRunning = clusterName
    ? await clusterExists(clusterName, projectRoot)
    : false;

  logger.info(`Instance: ${lockfile.instance.name}`);
  logger.info(`State: ${tiltRunning ? "running" : "stopped"}`);
  if (tiltPid) {
    logger.info(`Tilt: ${tiltRunning ? `pid ${tiltPid}` : "not running"}`);
  }
  if (clusterName) {
    logger.info(`k3d: ${clusterName} (${k3dRunning ? "running" : "missing"})`);
  }
  if (lockfile.instance.identity.k3dRegistryName) {
    logger.info(`Registry: ${lockfile.instance.identity.k3dRegistryName}`);
  }
  if (lockfile.instance.identity.kubeconfigPath) {
    logger.info(`Kubeconfig: ${lockfile.instance.identity.kubeconfigPath}`);
  }

  logger.info("Ports:");
  Object.entries(lockfile.instance.ports).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });

  if (config && config.urlOrder.length > 0) {
    const urls = resolveTemplateRecord(
      config.urls,
      config.urlOrder,
      buildTemplateVars({
        identity: lockfile.instance.identity,
        ports: lockfile.instance.ports,
      })
    );
    logger.info("URLs:");
    Object.entries(urls).forEach(([key, value]) => {
      logger.info(`  ${key}: ${value}`);
    });
  }
};
