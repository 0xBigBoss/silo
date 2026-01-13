import { loadConfig } from "../core/config";
import { buildInstanceState, resolveInstanceName } from "../core/instance";
import { renderEnvFile, resolveEnvPath } from "../core/env";
import { readLockfile, writeLockfile } from "../core/lockfile";
import { logger } from "../utils/logger";
import type { PortAllocationEvent } from "../core/ports";

export const env = async (nameArg: string | undefined, options: { config: string }) => {
  logger.info("Loading config");
  const config = await loadConfig(options.config);
  logger.verbose(`Config path: ${config.configPath}`);
  const lockfile = await readLockfile(config.projectRoot);

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
    lockfile,
    force: false,
    onPortAllocation: (event) => portEvents.push(event),
  });

  portEvents.forEach((event) => {
    if (event.source === "ephemeral") {
      logger.warn(
        `Port ${event.key} in use (${event.requestedDefault}), allocated ${event.assigned}`
      );
      logger.verbose(`Port ${event.key} source: ${event.source}`);
      return;
    }
    logger.verbose(`Port ${event.key} source: ${event.source} (${event.assigned})`);
  });

  const envPath = resolveEnvPath(config);
  const envContent = renderEnvFile({
    state,
    config,
    urls,
    hostOrder,
    portOrder,
    urlOrder,
  });

  await Bun.write(envPath, envContent);
  await writeLockfile(config.projectRoot, state);

  logger.info(`Generated env file at ${envPath}`);
  logger.info("Wrote lockfile");
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
