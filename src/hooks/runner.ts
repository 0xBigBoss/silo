import { HOOK_TIMEOUT_MS } from "../core/constants";
import { runCommandChecked } from "../utils/exec";

export const runHooks = async (params: {
  hooks: string[] | undefined;
  env: Record<string, string>;
  cwd: string;
  phase: string;
}): Promise<void> => {
  const { hooks, env, cwd, phase } = params;
  if (!hooks || hooks.length === 0) {
    return;
  }

  for (const hook of hooks) {
    await runCommandChecked(["/bin/sh", "-c", hook], {
      cwd,
      env,
      timeoutMs: HOOK_TIMEOUT_MS,
      context: `hook ${phase}: ${hook}`,
      stdio: "inherit",
    });
  }
};
