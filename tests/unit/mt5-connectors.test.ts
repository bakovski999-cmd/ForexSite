import { beforeEach, describe, expect, test } from "vitest";

import {
  buildMt5ConnectorTokenPreview,
  generateMt5ConnectorToken,
  hashMt5ConnectorToken,
} from "@/lib/mt5";
import {
  createMemoryMt5SyncRepository,
  resetMt5MemoryStoreForTests,
} from "@/lib/mt5-repository";

describe("MT5 connector tokens", () => {
  test("generates one-time connector tokens with stable hashes and safe previews", () => {
    const token = generateMt5ConnectorToken();
    const hash = hashMt5ConnectorToken(token);

    expect(token).toMatch(/^mt5_[a-f0-9]{64}$/);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashMt5ConnectorToken(token)).toBe(hash);
    expect(buildMt5ConnectorTokenPreview(token)).toMatch(/^mt5_[a-f0-9]{6}...[a-f0-9]{4}$/);
  });
});

describe("memory MT5 connector repository", () => {
  beforeEach(() => {
    resetMt5MemoryStoreForTests();
  });

  test("creates user scoped connectors and finds them by token hash", async () => {
    const repository = createMemoryMt5SyncRepository();
    const token = generateMt5ConnectorToken();
    const connector = await repository.createConnector({
      name: "PU Prime MT5",
      token,
      userId: "user-1",
    });

    await repository.createConnector({
      name: "Other MT5",
      token: generateMt5ConnectorToken(),
      userId: "user-2",
    });

    const userConnectors = await repository.listConnectors("user-1");
    const found = await repository.findConnectorByTokenHash(hashMt5ConnectorToken(token));

    expect(userConnectors).toHaveLength(1);
    expect(userConnectors[0]).toMatchObject({
      id: connector.id,
      name: "PU Prime MT5",
      tokenPreview: buildMt5ConnectorTokenPreview(token),
      userId: "user-1",
    });
    expect(found?.id).toBe(connector.id);
    expect(found?.userId).toBe("user-1");
  });
});
