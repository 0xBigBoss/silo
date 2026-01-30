import { sleep } from "./sleep";

export const withRetry = async <T>(
  fn: (attempt: number) => Promise<T> | T,
  params: {
    attempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  }
): Promise<T> => {
  const { attempts, baseDelayMs, maxDelayMs } = params;
  let lastError: unknown;
  const totalAttempts = Math.max(1, attempts);

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= totalAttempts) {
        break;
      }
      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};
