import { loadConfig } from "../core/config";
import { buildInstanceState, resolveInstanceName } from "../core/instance";
import { renderEnvFile, resolveEnvPath } from "../core/env";
import { readLockfile, writeLockfile } from "../core/lockfile";
import { applyProfile, resolveProfileName } from "../core/profile";
import { logger } from "../utils/logger";
import { SiloError } from "../utils/errors";
import type { PortAllocationEvent } from "../core/ports";

export const env = async (
  nameArg: string | undefined,
  options: { config: string; force: boolean; profile: string | undefined }
) => {
  logger.info("Loading config");
  const baseConfig = await loadConfig(options.config);
  logger.verbose(`Config path: ${baseConfig.configPath}`);
  const lockfile = await readLockfile(baseConfig.projectRoot);

  const explicitProfile = options.profile ?? process.env.SILO_PROFILE;
  const lockfileProfileForResolution =
    options.force && !explicitProfile ? undefined : lockfile?.instance?.profile;

  const { name: profileName, source: profileSource } = resolveProfileName({
    profileFlag: options.profile,
    envProfile: process.env.SILO_PROFILE,
    lockfileProfile: lockfileProfileForResolution,
    profiles: baseConfig.profiles,
  });

  const currentProfile = lockfile?.instance?.profile;
  if (lockfile && currentProfile !== profileName) {
    if (!options.force) {
      const requested = profileName ?? "base";
      const current = currentProfile ?? "base";
      throw new SiloError(
        `Profile change requires --force (current: ${current}, requested: ${requested})`,
        "PROFILE_SWITCH"
      );
    }
    if (currentProfile && !profileName) {
      logger.info("Cleared profile, using base config");
    }
  }

  if (profileSource === "lockfile" && profileName) {
    logger.info(`Reusing profile '${profileName}' from lockfile`);
  }

  const config = profileName ? applyProfile(baseConfig, profileName) : baseConfig;
  if (profileName) {
    logger.info(`Profile: ${profileName}`);
  }

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
