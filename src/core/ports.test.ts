import { describe, expect, test } from "bun:test";
import { EPHEMERAL_PORT_START } from "./constants";
import { allocatePorts, type PortAllocationEvent } from "./ports";

const alwaysFree = async (_port: number): Promise<boolean> => true;

describe("allocatePorts", () => {
  test("allocates random ports from the ephemeral range in order", async () => {
    const allocated = await allocatePorts({
      ports: { APP_PORT: "random", API_PORT: "random" },
      order: ["APP_PORT", "API_PORT"],
      lockfilePorts: undefined,
      force: false,
      isPortFree: alwaysFree,
    });

    expect(allocated.APP_PORT).toBe(EPHEMERAL_PORT_START);
    expect(allocated.API_PORT).toBe(EPHEMERAL_PORT_START + 1);
  });

  test("reuses lockfile ports even when config uses random", async () => {
    const events: PortAllocationEvent[] = [];
    const allocated = await allocatePorts({
      ports: { APP_PORT: "random" },
      order: ["APP_PORT"],
      lockfilePorts: { APP_PORT: 62000 },
      force: false,
      isPortFree: alwaysFree,
      onEvent: (event) => events.push(event),
    });

    expect(allocated.APP_PORT).toBe(62000);
    expect(events[0]?.source).toBe("lockfile");
    expect(events[0]?.requestedDefault).toBe("random");
  });
});
