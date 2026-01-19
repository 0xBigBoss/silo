#!/usr/bin/env bun
import { parseArgs } from "util";
import { SiloError } from "./utils/errors";
import { setVerbose } from "./utils/logger";

const GLOBAL_HELP = `silo <command> [options]

Commands:
  help [command]  Show help (global or per-command)
  init            Create silo.toml starter config
  doc [topic]     Show bundled docs (e.g., config)
  up [name]       Start environment (creates k3d if needed, starts Tilt)
  down            Stop environment (stops Tilt, keeps k3d by default)
  status          Show current instance state
  env [name]      Generate env file only, don't start anything
  profiles        List available profiles from silo.toml
  version         Print silo version

Arguments:
  [name]          Instance name (e.g., main, feature-x, dev)
                  If omitted: reuses name from lockfile
                  If no lockfile: generates from directory + random suffix

Global Options:
  -c, --config    Path to config file (default: silo.toml)
  -v, --verbose   Show verbose output
  -h, --help      Show help

Help:
  silo help <command>
  silo <command> --help

Command Options:
  up:
    -f, --force      Regenerate ports even if lockfile exists
    -p, --profile    Use named profile (overrides SILO_PROFILE env var)

  down:
    --delete-cluster   Delete k3d cluster (default: keep for faster iteration)
    --clean            Remove env file and lockfile

  env:
    -f, --force      Regenerate ports even if lockfile exists
    -p, --profile    Use named profile for env generation
`;

const COMMAND_HELP: Record<string, string> = {
  help: GLOBAL_HELP,
  init: `silo init [options]

Create a starter silo.toml in the current directory.

Global Options:
  -c, --config    Path to config file (default: silo.toml)
  -v, --verbose   Show verbose output
  -h, --help      Show help
`,
  up: `silo up [name] [options]

Start environment (creates k3d if needed, starts Tilt).

Arguments:
  [name]          Instance name (e.g., main, feature-x, dev)

Options:
  -f, --force     Regenerate ports even if lockfile exists
  -p, --profile   Use named profile (overrides SILO_PROFILE env var)
  -c, --config    Path to config file (default: silo.toml)
  -v, --verbose   Show verbose output
  -h, --help      Show help
`,
  down: `silo down [options]

Stop environment (stops Tilt, keeps k3d by default).

Options:
  --delete-cluster   Delete k3d cluster (default: keep for faster iteration)
  --clean            Remove env file and lockfile
  -c, --config       Path to config file (default: silo.toml)
  -v, --verbose      Show verbose output
  -h, --help         Show help
`,
  status: `silo status [options]

Show current instance state.

Options:
  -c, --config    Path to config file (default: silo.toml)
  -v, --verbose   Show verbose output
  -h, --help      Show help
`,
  env: `silo env [name] [options]

Generate env file only, don't start anything.

Arguments:
  [name]          Instance name (e.g., main, feature-x, dev)

Options:
  -f, --force     Regenerate ports even if lockfile exists
  -p, --profile   Use named profile for env generation
  -c, --config    Path to config file (default: silo.toml)
  -v, --verbose   Show verbose output
  -h, --help      Show help
`,
  profiles: `silo profiles [options]

List available profiles from silo.toml.

Options:
  -c, --config    Path to config file (default: silo.toml)
  -v, --verbose   Show verbose output
  -h, --help      Show help
`,
  doc: `silo doc [topic]

Print bundled documentation.

Topics:
  config          silo.toml reference
  profiles        Profile configuration
  commands        CLI command reference
  lockfile        Lockfile format and behavior
  interpolation   Template variables and phases
  ports           Port allocation and validation
  k3d             k3d cluster integration
  hooks           Lifecycle hooks

Options:
  -v, --verbose   Show verbose output
  -h, --help      Show help
`,
  version: `silo version

Print the current silo version.
`,
};

const parsePackageVersion = (value: unknown): string => {
  if (!value || typeof value !== "object") {
    throw new SiloError("Invalid package.json contents", "VERSION_NOT_FOUND");
  }
  const record = value as Record<string, unknown>;
  const version = record.version;
  if (typeof version !== "string" || version.length === 0) {
    throw new SiloError("package.json version not found", "VERSION_NOT_FOUND");
  }
  return version;
};

const getVersion = async (): Promise<string> => {
  const packageJsonUrl = new URL("../package.json", import.meta.url);
  const file = Bun.file(packageJsonUrl);
  if (!(await file.exists())) {
    throw new SiloError("package.json not found", "VERSION_NOT_FOUND");
  }
  try {
    const data = await file.json();
    return parsePackageVersion(data);
  } catch (error) {
    if (error instanceof SiloError) {
      throw error;
    }
    throw new SiloError("Failed to read package.json", "VERSION_NOT_FOUND");
  }
};

const printHelpFor = (command?: string): void => {
  if (!command) {
    console.log(GLOBAL_HELP);
    return;
  }
  const helpText = COMMAND_HELP[command];
  if (helpText) {
    console.log(helpText);
    return;
  }
  console.log(GLOBAL_HELP);
};

const printHelp = (): void => {
  console.log(`${GLOBAL_HELP}
Examples:
  silo help up                  # Show subcommand help
  silo init                     # Create silo.toml in current directory
  silo up dev                   # Start instance 'dev'
  silo up                       # Reuse last instance name
  silo env feature-x            # Generate env only
  silo down                     # Stop Tilt (keep k3d)
  silo down --delete-cluster    # Stop Tilt and delete k3d
  silo status                   # Show what's running
  silo profiles                 # List available profiles
  silo version                  # Print silo version
`);
};

const main = async (): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      config: { type: "string", short: "c", default: "silo.toml" },
      force: { type: "boolean", short: "f", default: false },
      help: { type: "boolean", short: "h", default: false },
      verbose: { type: "boolean", short: "v", default: false },
      profile: { type: "string", short: "p" },
      "delete-cluster": { type: "boolean", default: false },
      clean: { type: "boolean", default: false },
    },
    allowPositionals: true,
    strict: true,
  });

  const [command, ...args] = positionals;

  setVerbose(values.verbose);

  if (values.help) {
    printHelpFor(command);
    return;
  }

  if (!command) {
    printHelp();
    return;
  }

  if (command === "help") {
    printHelpFor(args[0]);
    return;
  }

  switch (command) {
    case "init": {
      const mod = await import("./commands/init");
      await mod.init({ config: values.config });
      return;
    }
    case "doc": {
      const mod = await import("./commands/doc");
      await mod.doc(args[0]);
      return;
    }
    case "up": {
      const mod = await import("./commands/up");
      await mod.up(args[0], {
        config: values.config,
        force: values.force,
        profile: values.profile,
      });
      return;
    }
    case "down": {
      const mod = await import("./commands/down");
      await mod.down({
        config: values.config,
        "delete-cluster": values["delete-cluster"],
        clean: values.clean,
      });
      return;
    }
    case "status": {
      const mod = await import("./commands/status");
      await mod.status({ config: values.config });
      return;
    }
    case "env": {
      const mod = await import("./commands/env");
      await mod.env(args[0], {
        config: values.config,
        force: values.force,
        profile: values.profile,
      });
      return;
    }
    case "profiles": {
      const mod = await import("./commands/profiles");
      await mod.profiles({ config: values.config });
      return;
    }
    case "version": {
      const version = await getVersion();
      console.log(`silo v${version}`);
      return;
    }
    default:
      printHelp();
  }
};

main().catch((error: unknown) => {
  if (error instanceof SiloError) {
    console.error(`silo error: ${error.message}`);
  } else if (error instanceof Error) {
    console.error(`silo error: ${error.message}`);
  } else {
    console.error("silo error: unknown error");
  }
  process.exitCode = 1;
});
