import { loadConfig } from "../core/config";
import { buildInstanceState, resolveInstanceName } from "../core/instance";
import { writeEnvAndLockfile } from "../core/env";
import { readLockfile } from "../core/lockfile";
import { resolveAndApplyProfile } from "../core/profile";
import { logger, logPortAllocations } from "../utils/logger";
import type { PortAllocationEvent } from "../core/ports";

export const env = async (
  nameArg: string | undefined,
  options: { config: string; force: boolean; profile: string | undefined }
) => {
  logger.info("Loading config");
  const baseConfig = await loadConfig(options.config);
  logger.verbose(`Config path: ${baseConfig.configPath}`);
  const lockfile = await readLockfile(baseConfig.projectRoot);

  const { config, profileName } = resolveAndApplyProfile({
    baseConfig,
    profileFlag: options.profile,
    lockfile,
    force: options.force,
  });

  const nameSource = nameArg
    ? "arg"
    : lockfile?.instance?.name
    ? "lockfile"
    : "generated";
  const name = resolveInstanceName({
    nameArg,
    lockfile,
    projectRoot: config.projectRoot,
  });
  logger.info(`Resolved instance name: ${name} (${nameSource})`);

  logger.info("Allocating ports");
  const portEvents: PortAllocationEvent[] = [];

  const { state, urls, hostOrder, portOrder, urlOrder } = await buildInstanceState({
    config,
    name,
    profile: profileName,
    lockfile,
    force: options.force,
    onPortAllocation: (event) => portEvents.push(event),
  });

  logPortAllocations(portEvents);

  await writeEnvAndLockfile({ state, config, urls, hostOrder, portOrder, urlOrder });

  logger.info("Ports:");
  Object.entries(state.ports).forEach(([key, value]) => {
    logger.info(`  ${key}: ${value}`);
  });
  if (Object.keys(urls).length > 0) {
    logger.info("URLs:");
    Object.entries(urls).forEach(([key, value]) => {
      logger.info(`  ${key}: ${value}`);
    });
  }
};
