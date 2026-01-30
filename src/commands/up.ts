import { updateLockfile } from "../core/lockfile";
import { logger } from "../utils/logger";
import { startTilt } from "../backends/tilt";
import { prepareTiltEnvironment } from "./prepare";

export const up = async (
  nameArg: string | undefined,
  options: { config: string; force: boolean; profile: string | undefined }
): Promise<void> => {
  const { config, envVars } = await prepareTiltEnvironment({ nameArg, options });

  logger.info("Starting Tilt");
  const tiltProc = startTilt({ cwd: config.projectRoot, env: envVars });
  await updateLockfile(config.projectRoot, (current) => ({
    ...current.instance,
    tiltPid: tiltProc.pid,
    tiltStartedAt: new Date().toISOString(),
  }));
  logger.info(`Tilt started (pid ${tiltProc.pid})`);

  const handleExit = async () => {
    await updateLockfile(config.projectRoot, (current) => {
      const { tiltPid: _tiltPid, tiltStartedAt: _tiltStartedAt, ...rest } =
        current.instance;
      return rest;
    });
  };

  const signalHandler = async (signal: NodeJS.Signals) => {
    try {
      tiltProc.kill(signal);
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);

  await tiltProc.exited;
  await handleExit();
};
