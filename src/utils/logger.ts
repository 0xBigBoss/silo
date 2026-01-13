type LogFn = (...args: Array<string | number | boolean | object>) => void;

const formatPrefix = (level: string) => `silo ${level}:`;

let verboseEnabled = false;

export const setVerbose = (enabled: boolean): void => {
  verboseEnabled = enabled;
};

export const logger = {
  info: ((...args) => console.log(formatPrefix("info"), ...args)) as LogFn,
  warn: ((...args) => console.warn(formatPrefix("warn"), ...args)) as LogFn,
  error: ((...args) => console.error(formatPrefix("error"), ...args)) as LogFn,
  verbose: ((...args) => {
    if (verboseEnabled) {
      console.log(formatPrefix("verbose"), ...args);
    }
  }) as LogFn,
};
