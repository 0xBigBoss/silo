type DocTopicEntry = {
  file: string;
  description: string;
};

export const DOC_TOPICS: Record<string, DocTopicEntry> = {
  config: { file: "silo-toml.md", description: "silo.toml reference" },
  profiles: { file: "profiles.md", description: "Profile configuration" },
  commands: { file: "commands.md", description: "CLI command reference" },
  lockfile: { file: "lockfile.md", description: "Lockfile format and behavior" },
  interpolation: { file: "interpolation.md", description: "Template variables and phases" },
  ports: { file: "ports.md", description: "Port allocation and validation" },
  hosts: { file: "hosts.md", description: "Hostnames and browser isolation" },
  urls: { file: "urls.md", description: "URL templates and derived vars" },
  k3d: { file: "k3d.md", description: "k3d cluster integration" },
  hooks: { file: "hooks.md", description: "Lifecycle hooks" },
  logging: { file: "logging.md", description: "Logging behavior and verbosity" },
  troubleshooting: { file: "troubleshooting.md", description: "Common errors and fixes" },
  tilt: { file: "tilt.md", description: "Tilt integration and expectations" },
};

export const DOC_TOPIC_ALIASES: Record<string, keyof typeof DOC_TOPICS> = {
  "silo.toml": "config",
};
