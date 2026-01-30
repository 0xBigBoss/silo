import { loadConfig } from "../core/config";
import { buildInstanceState, resolveInstanceName } from "../core/instance";
import {
  appendGithubEnv,
  buildEnvVars,
  buildSiloProcessEnv,
  resolveEnvPath,
  writeEnvAndLockfile,
} from "../core/env";
import { readLockfile, updateLockfile } from "../core/lockfile";
import { resolveAndApplyProfile } from "../core/profile";
import { applyRegistryPortOverride } from "../core/registry";
import { ensureToolsAvailable } from "../utils/validate";
import { logger, logPortAllocations } from "../utils/logger";
import { runHooks } from "../hooks/runner";
import { ensureCluster, writeKubeconfig } from "../backends/k3d";
import { advertiseLocalRegistry } from "../backends/registry";
import { resolveRegistryHostPort } from "../backends/registry-port";
import { tiltCi } from "../backends/tilt";
import { findTiltPidsInDir, isPidRunning, isTiltProcess } from "../utils/process";
import { SiloError } from "../utils/errors";
import { resolveGithubEnvPath, shouldExportCiEnv } from "../utils/ci";
import type { PortAllocationEvent } from "../core/ports";

export const ci = async (
  nameArg: string | undefined,
  options: {
    config: string;
    force: boolean;
    profile: string | undefined;
    timeout: string | undefined;
    exportCi: boolean;
    tiltArgs: string[];
  }
): Promise<void> => {
  process.env.SILO_ACTIVE = "1";

  logger.info("Loading config");
  const baseConfig = await loadConfig(options.config);
  logger.verbose(`Config path: ${baseConfig.configPath}`);

  const lockfile = await readLockfile(baseConfig.projectRoot);

  if (lockfile?.instance?.tiltPid && isPidRunning(lockfile.instance.tiltPid)) {
    const isTilt = await isTiltProcess(lockfile.instance.tiltPid);
    if (isTilt) {
      throw new SiloError(
        `Instance '${lockfile.instance.name}' already running. Use 'silo down' first.`,
        "ALREADY_RUNNING"
      );
    }
  }

  const externalTilt = await findTiltPidsInDir(baseConfig.projectRoot);
  const trackedPid = lockfile?.instance?.tiltPid;
  const external = externalTilt.filter((pid) => pid !== trackedPid);
  if (external.length > 0) {
    throw new SiloError("Tilt already running outside silo. Stop it first.", "TILT_RUNNING");
  }

  const { config, profileName } = resolveAndApplyProfile({
    baseConfig,
    profileFlag: options.profile,
    lockfile,
    force: options.force,
  });

  const tools = ["tilt"];
  if (config.k3d?.enabled) {
    tools.push("k3d");
  }
  if (config.k3d?.registry?.enabled) {
    tools.push("kubectl", "docker");
  }
  logger.info(`Validating tools: ${tools.join(", ")}`);
  await ensureToolsAvailable(tools);

  const nameSource = nameArg
    ? "arg"
    : lockfile?.instance?.name
    ? "lockfile"
    : "generated";
  const name = resolveInstanceName({
    nameArg,
    lockfile,
    projectRoot: config.projectRoot,
  });
  logger.info(`Resolved instance name: ${name} (${nameSource})`);

  logger.info("Allocating ports");
  const portEvents: PortAllocationEvent[] = [];
  const { state, urls, envVars: baseEnvVars, hostOrder, portOrder, urlOrder, k3dArgs } =
    await buildInstanceState({
      config,
      name,
      profile: profileName,
      lockfile,
      force: options.force,
      onPortAllocation: (event) => portEvents.push(event),
    });

  logPortAllocations(portEvents);

  const envFilePath = resolveEnvPath(config);
  const siloEnv = buildSiloProcessEnv({ state, envFilePath });
  const envVars = { ...baseEnvVars, ...siloEnv };
  Object.assign(process.env, siloEnv);

  let currentState = state;
  let currentUrls = urls;
  let currentEnvVars = envVars;

  await writeEnvAndLockfile({
    state: currentState,
    config,
    urls: currentUrls,
    hostOrder,
    portOrder,
    urlOrder,
  });

  logger.info(`Running pre-up hooks (${config.hooks["pre-up"]?.length ?? 0})`);
  await runHooks({
    hooks: config.hooks["pre-up"],
    env: currentEnvVars,
    cwd: config.projectRoot,
    phase: "pre-up",
  });

  if (config.k3d?.enabled && currentState.identity.k3dClusterName) {
    const registryName = currentState.identity.k3dRegistryName;
    logger.info(`Ensuring k3d cluster '${currentState.identity.k3dClusterName}'`);
    const { created } = await ensureCluster({
      clusterName: currentState.identity.k3dClusterName,
      registryName,
      args: k3dArgs,
      cwd: config.projectRoot,
    });

    currentState = { ...currentState, k3dClusterCreated: true };

    if (currentState.identity.kubeconfigPath) {
      logger.info("Writing kubeconfig");
      await writeKubeconfig(
        currentState.identity.k3dClusterName!,
        currentState.identity.kubeconfigPath,
        config.projectRoot
      );
    }

    if (config.k3d?.registry?.enabled && registryName) {
      const actualPort = await resolveRegistryHostPort({
        registryName,
        cwd: config.projectRoot,
      });
      const { changed, state: reconciledState, urls: reconciledUrls } =
        applyRegistryPortOverride({
          state: currentState,
          config,
          actualPort,
        });
      if (changed) {
        const previousPort = currentState.ports.K3D_REGISTRY_PORT;
        logger.warn(
          `Registry port drift detected (requested ${previousPort}, actual ${actualPort}). Updating lockfile.`
        );
        currentState = reconciledState;
        currentUrls = reconciledUrls;
        currentEnvVars = { ...buildEnvVars(currentState, currentUrls), ...siloEnv };
        await writeEnvAndLockfile({
          state: currentState,
          config,
          urls: currentUrls,
          hostOrder,
          portOrder,
          urlOrder,
        });
      }
    }

    if (config.k3d?.registry?.enabled && currentState.identity.k3dRegistryName) {
      if (!currentState.identity.kubeconfigPath) {
        throw new SiloError(
          "Kubeconfig path missing for registry advertisement",
          "INVALID_STATE"
        );
      }
      const registryPort = currentState.ports.K3D_REGISTRY_PORT;
      if (!registryPort) {
        throw new SiloError(
          "K3D_REGISTRY_PORT missing for registry advertisement",
          "INVALID_STATE"
        );
      }
      const registryHost = `localhost:${registryPort}`;
      const registryHostFromCluster = `${currentState.identity.composeName}-registry.localhost:5000`;
      logger.info("Advertising registry via ConfigMap");
      await advertiseLocalRegistry({
        registryHost,
        registryHostFromContainerRuntime: registryHostFromCluster,
        registryHostFromClusterNetwork: registryHostFromCluster,
        kubeconfigPath: currentState.identity.kubeconfigPath,
        cwd: config.projectRoot,
      });
    }

    await updateLockfile(config.projectRoot, (current) => ({
      ...current.instance,
      k3dClusterCreated: true,
    }));

    logger.info(
      created
        ? `Created k3d cluster '${currentState.identity.k3dClusterName}'`
        : `Reusing k3d cluster '${currentState.identity.k3dClusterName}'`
    );
  }

  logger.info(`Running post-up hooks (${config.hooks["post-up"]?.length ?? 0})`);
  await runHooks({
    hooks: config.hooks["post-up"],
    env: currentEnvVars,
    cwd: config.projectRoot,
    phase: "post-up",
  });

  if (shouldExportCiEnv(options.exportCi)) {
    const githubEnvPath = resolveGithubEnvPath();
    await appendGithubEnv({
      state: currentState,
      urls: currentUrls,
      githubEnvPath,
    });
  }

  logger.info("Running tilt ci");
  await tiltCi({
    cwd: config.projectRoot,
    env: currentEnvVars,
    timeout: options.timeout,
    extraArgs: options.tiltArgs,
  });
};
