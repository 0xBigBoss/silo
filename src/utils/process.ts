import { PROCESS_CHECK_TIMEOUT_MS, TILT_STOP_TIMEOUT_MS } from "../core/constants";
import { runCommand } from "./exec";
import { sleep } from "./sleep";

export const isPidRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

export const getProcessCommand = async (pid: number): Promise<string | null> => {
  const result = await runCommand(["ps", "-p", String(pid), "-o", "comm="], {
    timeoutMs: PROCESS_CHECK_TIMEOUT_MS,
    context: `ps ${pid}`,
    stdio: "pipe",
  });
  if (result.exitCode !== 0) {
    return null;
  }
  const cmd = result.stdout.trim();
  return cmd.length > 0 ? cmd : null;
};

export const isTiltProcess = async (pid: number): Promise<boolean> => {
  const command = await getProcessCommand(pid);
  if (!command) {
    return false;
  }
  return command.includes("tilt");
};

export const findTiltPidsInDir = async (cwd: string): Promise<number[]> => {
  const pattern = `tilt.*${cwd}`;
  const result = await runCommand(["pgrep", "-f", pattern], {
    timeoutMs: PROCESS_CHECK_TIMEOUT_MS,
    context: `pgrep ${pattern}`,
    stdio: "pipe",
  });

  if (result.exitCode !== 0) {
    return [];
  }

  return result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => Number(line))
    .filter((pid) => Number.isInteger(pid));
};

export const stopProcess = async (pid: number): Promise<void> => {
  if (!isPidRunning(pid)) {
    return;
  }

  try {
    process.kill(pid, "SIGINT");
  } catch {
    return;
  }

  const start = Date.now();
  while (Date.now() - start < TILT_STOP_TIMEOUT_MS) {
    if (!isPidRunning(pid)) {
      return;
    }
    await sleep(200);
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
};
