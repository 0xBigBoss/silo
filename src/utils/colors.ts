// ANSI color helpers with TTY detection

const isTTY = process.stdout.isTTY ?? false;

const ansi = (code: string) => (text: string) =>
  isTTY ? `\x1b[${code}m${text}\x1b[0m` : text;

export const colors = {
  cyan: ansi("36"),
  green: ansi("32"),
  bold: ansi("1"),
  dim: ansi("2"),
};

export const isInteractive = (): boolean => isTTY;
