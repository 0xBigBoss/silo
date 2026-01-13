import path from "path";

const sanitize = (input: string): string => {
  const lowered = input.toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");
  const trimmed = replaced.replace(/^-+|-+$/g, "");
  const limited = trimmed.slice(0, 63).replace(/-+$/g, "");
  return limited.length > 0 ? limited : "instance";
};

const randomString = (length: number): string => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
};

export const sanitizeName = (input: string): string => sanitize(input);

export const generateName = (projectRoot: string): string => {
  const dir = path.basename(projectRoot);
  const suffix = randomString(4);
  return sanitize(`${dir}-${suffix}`);
};
