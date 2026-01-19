import path from "path";
import { SiloError } from "../utils/errors";

const TOPICS: Record<string, { file: string; description: string }> = {
  config: { file: "silo-toml.md", description: "silo.toml reference" },
  profiles: { file: "profiles.md", description: "Profile configuration" },
};

const TOPIC_ALIASES: Record<string, keyof typeof TOPICS> = {
  "silo.toml": "config",
};

const findDocPath = async (filename: string): Promise<string | null> => {
  const candidates = [
    path.resolve(import.meta.dir, "..", "docs", filename),
    path.resolve(import.meta.dir, "..", "..", "docs", filename),
  ];

  for (const candidate of candidates) {
    const file = Bun.file(candidate);
    if (await file.exists()) {
      return candidate;
    }
  }

  return null;
};

const printTopics = (): void => {
  console.log("Available docs:");
  for (const [topic, entry] of Object.entries(TOPICS)) {
    console.log(`  ${topic}  ${entry.description}`);
  }
};

export const doc = async (topicArg: string | undefined): Promise<void> => {
  if (!topicArg) {
    printTopics();
    return;
  }

  const topicKey = topicArg.toLowerCase();
  const canonicalTopic = TOPIC_ALIASES[topicKey] ?? topicKey;
  const entry = TOPICS[canonicalTopic];
  if (!entry) {
    throw new SiloError(`Unknown doc topic: ${topicArg}`, "DOC_NOT_FOUND");
  }

  const docPath = await findDocPath(entry.file);
  if (!docPath) {
    throw new SiloError(`Doc file not found: ${entry.file}`, "DOC_NOT_FOUND");
  }

  const contents = await Bun.file(docPath).text();
  process.stdout.write(contents.trimEnd() + "\n");
};
