import { loadConfig } from "../core/config";
import { buildInstanceState, resolveInstanceName } from "../core/instance";
import { renderEnvFile, resolveEnvPath } from "../core/env";
import { readLockfile, updateLockfile, writeLockfile } from "../core/lockfile";
import { ensureToolsAvailable } from "../utils/validate";
import { logger } from "../utils/logger";
import { runHooks } from "../hooks/runner";
import { ensureCluster, writeKubeconfig } from "../backends/k3d";
import { advertiseLocalRegistry } from "../backends/registry";
import { startTilt } from "../backends/tilt";
import { findTiltPidsInDir, isPidRunning, isTiltProcess } from "../utils/process";
import { SiloError } from "../utils/errors";
import type { PortAllocationEvent } from "../core/ports";

export const up = async (
  nameArg: string | undefined,
  options: { config: string; force: boolean }
): Promise<void> => {
  logger.info("Loading config");
  const config = await loadConfig(options.config);
  logger.verbose(`Config path: ${config.configPath}`);

  const tools = ["tilt"];
  if (config.k3d?.enabled) {
    tools.push("k3d");
  }
  if (config.k3d?.registry?.enabled) {
    tools.push("kubectl");
  }
  logger.info(`Validating tools: ${tools.join(", ")}`);
  await ensureToolsAvailable(tools);

  const lockfile = await readLockfile(config.projectRoot);

  if (lockfile?.instance?.tiltPid && isPidRunning(lockfile.instance.tiltPid)) {
    const isTilt = await isTiltProcess(lockfile.instance.tiltPid);
    if (isTilt) {
      throw new SiloError(
        `Instance '${lockfile.instance.name}' already running. Use 'silo down' first.`,
        "ALREADY_RUNNING"
      );
    }
  }

  const externalTilt = await findTiltPidsInDir(config.projectRoot);
  const trackedPid = lockfile?.instance?.tiltPid;
  const external = externalTilt.filter((pid) => pid !== trackedPid);
  if (external.length > 0) {
    throw new SiloError(
      "Tilt already running outside silo. Stop it first.",
      "TILT_RUNNING"
    );
  }

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
  const { state, urls, envVars, hostOrder, portOrder, urlOrder, k3dArgs } =
    await buildInstanceState({
      config,
      name,
      lockfile,
      force: options.force,
      onPortAllocation: (event) => portEvents.push(event),
    });

  portEvents.forEach((event) => {
    if (event.source === "ephemeral") {
      logger.warn(
        `Port ${event.key} in use (${event.requestedDefault}), allocated ${event.assigned}`
      );
      logger.verbose(`Port ${event.key} source: ${event.source}`);
      return;
    }
    logger.verbose(`Port ${event.key} source: ${event.source} (${event.assigned})`);
  });

  const envPath = resolveEnvPath(config);
  const envContent = renderEnvFile({
    state,
    config,
    urls,
    hostOrder,
    portOrder,
    urlOrder,
  });

  await Bun.write(envPath, envContent);
  await writeLockfile(config.projectRoot, state);
  logger.info(`Generated env file at ${envPath}`);
  logger.info("Wrote lockfile");

  logger.info(`Running pre-up hooks (${config.hooks["pre-up"]?.length ?? 0})`);
  await runHooks({
    hooks: config.hooks["pre-up"],
    env: envVars,
    cwd: config.projectRoot,
    phase: "pre-up",
  });

  if (config.k3d?.enabled && state.identity.k3dClusterName) {
    const registryName = state.identity.k3dRegistryName;
    logger.info(`Ensuring k3d cluster '${state.identity.k3dClusterName}'`);
    const { created } = await ensureCluster({
      clusterName: state.identity.k3dClusterName,
      registryName,
      args: k3dArgs,
      cwd: config.projectRoot,
    });

    state.k3dClusterCreated = true;

    if (state.identity.kubeconfigPath) {
      logger.info(`Writing kubeconfig`);
      await writeKubeconfig(
        state.identity.k3dClusterName,
        state.identity.kubeconfigPath,
        config.projectRoot
      );
    }

    if (config.k3d?.registry?.enabled && state.identity.k3dRegistryName) {
      if (!state.identity.kubeconfigPath) {
        throw new SiloError("Kubeconfig path missing for registry advertisement", "INVALID_STATE");
      }
      const registryPort = state.ports.K3D_REGISTRY_PORT;
      if (!registryPort) {
        throw new SiloError("K3D_REGISTRY_PORT missing for registry advertisement", "INVALID_STATE");
      }
      const registryHost = `localhost:${registryPort}`;
      const registryHostFromCluster = `${state.identity.composeName}-registry.localhost:5000`;
      logger.info("Advertising registry via ConfigMap");
      await advertiseLocalRegistry({
        registryHost,
        registryHostFromContainerRuntime: registryHostFromCluster,
        registryHostFromClusterNetwork: registryHostFromCluster,
        kubeconfigPath: state.identity.kubeconfigPath,
        cwd: config.projectRoot,
      });
    }

    await updateLockfile(config.projectRoot, (current) => ({
      ...current.instance,
      k3dClusterCreated: true,
    }));

    logger.info(
      created
        ? `Created k3d cluster '${state.identity.k3dClusterName}'`
        : `Reusing k3d cluster '${state.identity.k3dClusterName}'`
    );
  }

  logger.info(`Running post-up hooks (${config.hooks["post-up"]?.length ?? 0})`);
  await runHooks({
    hooks: config.hooks["post-up"],
    env: envVars,
    cwd: config.projectRoot,
    phase: "post-up",
  });

  logger.info("Starting Tilt");
  const tiltProc = startTilt({ cwd: config.projectRoot, env: envVars });
  await updateLockfile(config.projectRoot, (current) => ({
    ...current.instance,
    tiltPid: tiltProc.pid,
    tiltStartedAt: new Date().toISOString(),
  }));
  logger.info(`Tilt started (pid ${tiltProc.pid})`);

  const handleExit = async () => {
    await updateLockfile(config.projectRoot, (current) => {
      const { tiltPid: _tiltPid, tiltStartedAt: _tiltStartedAt, ...rest } =
        current.instance;
      return rest;
    });
  };

  const signalHandler = async (signal: NodeJS.Signals) => {
    try {
      tiltProc.kill(signal);
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", signalHandler);
  process.on("SIGTERM", signalHandler);

  await tiltProc.exited;
  await handleExit();
};
