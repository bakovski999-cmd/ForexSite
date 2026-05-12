import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

export type Mt5ConnectionStatus = "live" | "stale" | "offline";

const finiteNumber = z.number().finite();
const stringFromNumber = z.union([z.string().trim().min(1), z.number().finite()]).transform(String);

const mt5TerminalSchema = z
  .object({
    name: z.string().trim().default("MetaTrader 5"),
    build: finiteNumber.optional().default(0),
    path: z.string().trim().optional().default(""),
  })
  .default({ name: "MetaTrader 5", build: 0, path: "" });

const mt5AccountSchema = z.object({
  login: stringFromNumber,
  server: z.string().trim().min(1),
  broker: z.string().trim().optional().default(""),
  company: z.string().trim().optional().default(""),
  currency: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  balance: finiteNumber,
  equity: finiteNumber,
  margin: finiteNumber,
  freeMargin: finiteNumber,
  marginLevel: finiteNumber,
  leverage: finiteNumber,
  profit: finiteNumber,
});

const mt5PositionSchema = z.object({
  ticket: stringFromNumber,
  symbol: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  type: z.enum(["buy", "sell"]),
  volume: finiteNumber,
  openPrice: finiteNumber,
  currentPrice: finiteNumber,
  stopLoss: finiteNumber.optional().default(0),
  takeProfit: finiteNumber.optional().default(0),
  profit: finiteNumber,
  swap: finiteNumber.optional().default(0),
  commission: finiteNumber.optional().default(0),
  magic: z.union([z.string(), z.number().finite()]).optional().default(0).transform(String),
  comment: z.string().optional().default(""),
  openTime: z.string().trim().optional().default(""),
  contractSize: finiteNumber.optional(),
  currencyProfit: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  currencyMargin: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toUpperCase() : undefined)),
  tickSize: finiteNumber.optional(),
  tickValue: finiteNumber.optional(),
});

const mt5HistoryDealSchema = z.object({
  ticket: stringFromNumber,
  orderTicket: stringFromNumber.optional().default(""),
  symbol: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  type: z.string().trim().min(1),
  entry: z.string().trim().optional().default(""),
  volume: finiteNumber,
  price: finiteNumber,
  profit: finiteNumber,
  swap: finiteNumber.optional().default(0),
  commission: finiteNumber.optional().default(0),
  time: z.string().trim().optional().default(""),
});

export const mt5SnapshotPayloadSchema = z.object({
  version: z.literal(1),
  sentAt: z.string().trim().min(1),
  terminal: mt5TerminalSchema,
  account: mt5AccountSchema,
  positions: z.array(mt5PositionSchema).default([]),
  historyDeals: z.array(mt5HistoryDealSchema).default([]),
});

export type Mt5SnapshotPayload = z.infer<typeof mt5SnapshotPayloadSchema>;

export type Mt5StoredSnapshot = {
  id: string;
  connectorId?: string | null;
  userId?: string | null;
  connectionKey: string;
  accountLogin: string;
  server: string;
  receivedAt: string;
  payload: Mt5SnapshotPayload;
};

export type Mt5Connector = {
  id: string;
  userId: string;
  name: string;
  tokenPreview: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
};

export type Mt5LatestResponse = {
  ok: true;
  status: Mt5ConnectionStatus;
  liveSeconds: number;
  offlineSeconds: number;
  now: string;
  snapshot: Mt5StoredSnapshot | null;
};

export type Mt5HistoryResponse = {
  ok: true;
  snapshots: Mt5StoredSnapshot[];
};

export type Mt5ConnectorsResponse = {
  ok: true;
  connectors: Mt5Connector[];
};

export type Mt5CreatedConnectorResponse = {
  ok: true;
  connector: Mt5Connector;
  token: string;
  endpointUrl: string;
  webRequestUrl: string;
  downloadUrl: string;
};

export const parseMt5SnapshotPayload = Object.assign(
  (payload: unknown) => mt5SnapshotPayloadSchema.parse(payload),
  {
    safeParse: (payload: unknown) => mt5SnapshotPayloadSchema.safeParse(payload),
  },
);

export function buildMt5ConnectionKey(payload: Mt5SnapshotPayload) {
  return `${payload.account.server}:${payload.account.login}`;
}

export function generateMt5ConnectorToken() {
  return `mt5_${randomBytes(32).toString("hex")}`;
}

export function hashMt5ConnectorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildMt5ConnectorTokenPreview(token: string) {
  return `${token.slice(0, 10)}...${token.slice(-4)}`;
}

export function calculateMt5ConnectionStatus(
  receivedAt: string | null | undefined,
  now = new Date(),
  thresholds: { liveSeconds: number; offlineSeconds: number },
): Mt5ConnectionStatus {
  if (!receivedAt) {
    return "offline";
  }

  const receivedTime = new Date(receivedAt).getTime();

  if (!Number.isFinite(receivedTime)) {
    return "offline";
  }

  const ageSeconds = Math.max(0, (now.getTime() - receivedTime) / 1000);

  if (ageSeconds <= thresholds.liveSeconds) {
    return "live";
  }

  if (ageSeconds <= thresholds.offlineSeconds) {
    return "stale";
  }

  return "offline";
}
