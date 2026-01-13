import { TILT_DOWN_TIMEOUT_MS } from "../core/constants";
import { runCommandChecked } from "../utils/exec";

export const startTilt = (params: {
  cwd: string;
  env: Record<string, string>;
}): Bun.Subprocess => {
  const { cwd, env } = params;
  return Bun.spawn(["tilt", "up"], {
    cwd,
    env: { ...process.env, ...env },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
};

export const tiltDown = async (params: {
  cwd: string;
  env: Record<string, string>;
}): Promise<void> => {
  const { cwd, env } = params;
  await runCommandChecked(["tilt", "down"], {
    cwd,
    env,
    timeoutMs: TILT_DOWN_TIMEOUT_MS,
    context: "tilt down",
    stdio: "inherit",
  });
};
