import {
  EPHEMERAL_PORT_END,
  EPHEMERAL_PORT_START,
  PORT_CHECK_TIMEOUT_MS,
} from "./constants";
import { withTimeout } from "../utils/timeout";
import { SiloError } from "../utils/errors";

const isPortInRange = (port: number): boolean => port >= 1 && port <= 65535;

const checkPortFree = async (port: number): Promise<boolean> => {
  const attempt = async (): Promise<boolean> => {
    try {
      const server = Bun.listen({
        hostname: "0.0.0.0",
        port,
        socket: {
          data() {},
        },
      });
      server.stop();
      return true;
    } catch {
      return false;
    }
  };

  return await withTimeout(attempt(), PORT_CHECK_TIMEOUT_MS, `port check ${port}`);
};

export type PortAllocationSource = "lockfile" | "default" | "ephemeral";

export type PortAllocationEvent = {
  key: string;
  requestedDefault: number;
  requestedLock?: number;
  assigned: number;
  source: PortAllocationSource;
};

const findEphemeralPort = async (used: Set<number>, startAt: number): Promise<number> => {
  for (let port = startAt; port <= EPHEMERAL_PORT_END; port += 1) {
    if (used.has(port)) {
      continue;
    }
    if (await checkPortFree(port)) {
      return port;
    }
  }
  throw new SiloError("No free ports available in ephemeral range", "PORTS_EXHAUSTED");
};

export const allocatePorts = async (params: {
  ports: Record<string, number>;
  order: string[];
  lockfilePorts: Record<string, number> | undefined;
  force: boolean;
  onEvent?: (event: PortAllocationEvent) => void;
}): Promise<Record<string, number>> => {
  const { ports, order, lockfilePorts, force, onEvent } = params;
  const allocated: Record<string, number> = {};
  const used = new Set<number>();
  let nextEphemeral = EPHEMERAL_PORT_START;

  for (const key of order) {
    const defaultPort = ports[key];
    if (defaultPort === undefined || !isPortInRange(defaultPort)) {
      throw new SiloError(`Invalid port for ${key}: ${defaultPort}`, "INVALID_PORT");
    }

    const candidates: Array<{ port: number; source: PortAllocationSource }> = [];
    const lockPort = !force ? lockfilePorts?.[key] : undefined;
    if (lockPort && isPortInRange(lockPort)) {
      candidates.push({ port: lockPort, source: "lockfile" });
    }
    candidates.push({ port: defaultPort, source: "default" });

    let assigned: number | undefined;
    let source: PortAllocationSource = "default";
    for (const candidate of candidates) {
      if (used.has(candidate.port)) {
        continue;
      }
      if (await checkPortFree(candidate.port)) {
        assigned = candidate.port;
        source = candidate.source;
        break;
      }
    }

    if (!assigned) {
      assigned = await findEphemeralPort(used, nextEphemeral);
      nextEphemeral = assigned + 1;
      source = "ephemeral";
    }

    allocated[key] = assigned;
    used.add(assigned);
    if (onEvent) {
      const event: PortAllocationEvent = {
        key,
        requestedDefault: defaultPort,
        assigned,
        source,
        ...(lockPort && isPortInRange(lockPort) ? { requestedLock: lockPort } : {}),
      };
      onEvent(event);
    }
  }

  return allocated;
};
