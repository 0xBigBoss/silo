import { withTimeout } from "./timeout";
import { SiloError } from "./errors";

export interface CommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs: number;
  context: string;
  stdio?: "inherit" | "pipe";
}

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

const toText = async (
  stream: ReadableStream | null | undefined
): Promise<string> => {
  if (!stream) {
    return "";
  }
  const response = new Response(stream);
  return await response.text();
};

export async function runCommand(
  cmd: string[],
  options: CommandOptions
): Promise<CommandResult> {
  const { cwd, env, timeoutMs, context, stdio = "inherit" } = options;
  const spawnOptions: Parameters<typeof Bun.spawn>[1] = {
    env: env ? { ...process.env, ...env } : process.env,
    stdin: "ignore",
    stdout: stdio,
    stderr: stdio,
  };
  if (cwd) {
    spawnOptions.cwd = cwd;
  }

  const proc = Bun.spawn(cmd, spawnOptions);

  try {
    if (stdio === "inherit") {
      const exitCode = await withTimeout(proc.exited, timeoutMs, context);
      return { exitCode, stdout: "", stderr: "" };
    }

    const resultPromise = (async () => {
      const stdoutStream = proc.stdout as ReadableStream | null | undefined;
      const stderrStream = proc.stderr as ReadableStream | null | undefined;
      const [stdout, stderr, exitCode] = await Promise.all([
        toText(stdoutStream),
        toText(stderrStream),
        proc.exited,
      ]);
      return { exitCode, stdout, stderr };
    })();

    return await withTimeout(resultPromise, timeoutMs, context);
  } catch (error) {
    try {
      proc.kill();
    } catch {
      // ignore
    }
    throw error;
  }
}

export async function runCommandChecked(
  cmd: string[],
  options: CommandOptions
): Promise<CommandResult> {
  const result = await runCommand(cmd, options);
  if (result.exitCode !== 0) {
    throw new SiloError(
      `Command failed (${result.exitCode}): ${options.context}`,
      "COMMAND_FAILED"
    );
  }
  return result;
}
