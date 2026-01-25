import path from "path";
import { createHash } from "node:crypto";
import {
  K3D_CLUSTER_NAME_HASH_LENGTH,
  K3D_CLUSTER_NAME_MAX_LENGTH,
  K3D_CLUSTER_NAME_SUFFIX_LENGTH,
} from "./constants";

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

const hashName = (input: string): string =>
  createHash("sha256").update(input).digest("hex");

const pickSuffix = (name: string): string => {
  const parts = name.split("-").filter(Boolean);
  const tail = parts.at(-1) ?? name;
  return tail.slice(-K3D_CLUSTER_NAME_SUFFIX_LENGTH);
};

export const shortenK3dClusterName = (name: string): string => {
  if (name.length <= K3D_CLUSTER_NAME_MAX_LENGTH) {
    return name;
  }

  const hash = hashName(name).slice(0, K3D_CLUSTER_NAME_HASH_LENGTH);
  const suffix = pickSuffix(name);
  const reserved = hash.length + suffix.length + 2;
  const prefixMax = Math.max(1, K3D_CLUSTER_NAME_MAX_LENGTH - reserved);
  const prefix = name.slice(0, prefixMax).replace(/-+$/g, "");
  const safePrefix = prefix.length > 0 ? prefix : name.slice(0, prefixMax);

  return `${safePrefix}-${hash}-${suffix}`;
};
