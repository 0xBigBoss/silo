import { loadConfig } from "../core/config";
import { logger } from "../utils/logger";

export const profiles = async (options: { config: string }): Promise<void> => {
  logger.info("Loading config");
  const config = await loadConfig(options.config);
  logger.verbose(`Config path: ${config.configPath}`);

  const profiles = config.profiles ?? {};
  const names = Object.keys(profiles);

  if (names.length === 0) {
    logger.info("No profiles defined");
    return;
  }

  logger.info("Available profiles:");
  names.forEach((name) => {
    logger.info(`  ${name}`);
  });
};
