import { SiloError } from "./errors";

const isTruthy = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  if (normalized === "0" || normalized === "false") {
    return false;
  }
  return true;
};

const isCiEnv = (): boolean =>
  isTruthy(process.env.GITHUB_ACTIONS) || isTruthy(process.env.CI);

export const shouldExportCiEnv = (exportCi: boolean | undefined): boolean =>
  Boolean(exportCi) || isCiEnv();

export const resolveGithubEnvPath = (): string => {
  const githubEnvPath = process.env.GITHUB_ENV;
  if (!githubEnvPath || githubEnvPath.trim().length === 0) {
    throw new SiloError(
      "GITHUB_ENV is not set; cannot export env vars for CI",
      "GITHUB_ENV_MISSING"
    );
  }
  return githubEnvPath;
};
