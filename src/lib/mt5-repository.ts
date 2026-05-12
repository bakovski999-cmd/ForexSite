import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { env, isFirebaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  buildMt5ConnectorTokenPreview,
  buildMt5ConnectionKey,
  hashMt5ConnectorToken,
  type Mt5Connector,
  type Mt5SnapshotPayload,
  type Mt5StoredSnapshot,
} from "@/lib/mt5";

type SaveSnapshotOptions = {
  connectorId?: string | null;
  receivedAt?: Date;
  userId?: string | null;
};

type CreateConnectorOptions = {
  userId: string;
  name: string;
  token: string;
};

export interface Mt5SyncRepository {
  createConnector(options: CreateConnectorOptions): Promise<Mt5Connector>;
  listConnectors(userId: string): Promise<Mt5Connector[]>;
  findConnectorByTokenHash(tokenHash: string): Promise<Mt5Connector | null>;
  markConnectorSeen(connectorId: string, lastSeenAt: Date): Promise<void>;
  saveSnapshot(
    payload: Mt5SnapshotPayload,
    options?: SaveSnapshotOptions,
  ): Promise<Mt5StoredSnapshot>;
  getLatestSnapshot(options?: { userId?: string }): Promise<Mt5StoredSnapshot | null>;
  getSnapshotHistory(options?: {
    limit?: number;
    connectionKey?: string;
    userId?: string;
  }): Promise<Mt5StoredSnapshot[]>;
}

type Mt5MemoryStore = {
  connectors: Array<Mt5Connector & { tokenHash: string }>;
  snapshots: Mt5StoredSnapshot[];
};

declare global {
  var __goldIntelMt5MemoryStore: Mt5MemoryStore | undefined;
}

function getMemoryStore() {
  global.__goldIntelMt5MemoryStore ??= {
    connectors: [],
    snapshots: [],
  };

  return global.__goldIntelMt5MemoryStore;
}

function clampHistoryLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(500, Math.max(1, Math.trunc(limit!)));
}

function buildStoredSnapshot(
  payload: Mt5SnapshotPayload,
  options?: SaveSnapshotOptions,
): Mt5StoredSnapshot {
  const receivedAt = options?.receivedAt ?? new Date();

  return {
    id: randomUUID(),
    connectorId: options?.connectorId ?? null,
    userId: options?.userId ?? null,
    connectionKey: buildMt5ConnectionKey(payload),
    accountLogin: payload.account.login,
    server: payload.account.server,
    receivedAt: receivedAt.toISOString(),
    payload,
  };
}

function sortNewestFirst(snapshots: Mt5StoredSnapshot[]) {
  return [...snapshots].sort(
    (first, second) =>
      new Date(second.receivedAt).getTime() - new Date(first.receivedAt).getTime(),
  );
}

class MemoryMt5SyncRepository implements Mt5SyncRepository {
  async createConnector(options: CreateConnectorOptions) {
    const now = new Date().toISOString();
    const connector = {
      id: randomUUID(),
      userId: options.userId,
      name: options.name,
      tokenHash: hashMt5ConnectorToken(options.token),
      tokenPreview: buildMt5ConnectorTokenPreview(options.token),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: null,
    };
    const store = getMemoryStore();
    store.connectors = [connector, ...store.connectors];

    return connector;
  }

  async listConnectors(userId: string) {
    return getMemoryStore().connectors.filter((connector) => connector.userId === userId);
  }

  async findConnectorByTokenHash(tokenHash: string) {
    return getMemoryStore().connectors.find((connector) => connector.tokenHash === tokenHash) ?? null;
  }

  async markConnectorSeen(connectorId: string, lastSeenAt: Date) {
    const store = getMemoryStore();
    const lastSeenAtIso = lastSeenAt.toISOString();
    store.connectors = store.connectors.map((connector) =>
      connector.id === connectorId
        ? { ...connector, lastSeenAt: lastSeenAtIso, updatedAt: lastSeenAtIso }
        : connector,
    );
  }

  async saveSnapshot(payload: Mt5SnapshotPayload, options?: SaveSnapshotOptions) {
    const snapshot = buildStoredSnapshot(payload, options);
    const store = getMemoryStore();
    store.snapshots = [snapshot, ...store.snapshots];

    return snapshot;
  }

  async getLatestSnapshot(options?: { userId?: string }) {
    const snapshots = getMemoryStore().snapshots.filter((snapshot) =>
      options?.userId ? snapshot.userId === options.userId : true,
    );

    return sortNewestFirst(snapshots)[0] ?? null;
  }

  async getSnapshotHistory(options?: { limit?: number; connectionKey?: string; userId?: string }) {
    const limit = clampHistoryLimit(options?.limit);
    const snapshots = getMemoryStore().snapshots.filter((snapshot) => {
      if (options?.connectionKey && snapshot.connectionKey !== options.connectionKey) {
        return false;
      }

      if (options?.userId && snapshot.userId !== options.userId) {
        return false;
      }

      return true;
    });

    return sortNewestFirst(snapshots).slice(0, limit);
  }
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseServiceClient() {
  supabaseClient ??= createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

function mapSupabaseSnapshot(row: Record<string, unknown>): Mt5StoredSnapshot {
  return {
    id: String(row.id),
    connectorId: row.connector_id ? String(row.connector_id) : null,
    userId: row.user_id ? String(row.user_id) : null,
    connectionKey: String(row.connection_key),
    accountLogin: String(row.account_login),
    server: String(row.server),
    receivedAt: String(row.received_at),
    payload: row.payload as Mt5SnapshotPayload,
  };
}

function mapSupabaseConnector(row: Record<string, unknown>): Mt5Connector {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    tokenPreview: String(row.token_preview),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastSeenAt: row.last_seen_at ? String(row.last_seen_at) : null,
  };
}

type StorageMt5Connector = Mt5Connector & { tokenHash: string };

const MT5_STORAGE_BUCKET = "mt5-sync";

function sanitizeStorageSegment(value: string | null | undefined) {
  return Buffer.from(value || "_legacy", "utf8").toString("base64url");
}

function connectorWithoutHash(connector: StorageMt5Connector): Mt5Connector {
  return {
    id: connector.id,
    userId: connector.userId,
    name: connector.name,
    tokenPreview: connector.tokenPreview,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
    lastSeenAt: connector.lastSeenAt,
  };
}

function isMissingMt5TableError(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  const code = record?.code ?? "";
  const message = record?.message ?? "";

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    (message.includes("schema cache") && message.includes("mt5_")) ||
    (message.includes("relation") && message.includes("mt5_") && message.includes("does not exist"))
  );
}

function isMissingStorageObjectError(error: unknown) {
  const record = error as { statusCode?: string | number; message?: string } | null;
  const statusCode = String(record?.statusCode ?? "");
  const message = record?.message?.toLowerCase() ?? "";

  return statusCode === "404" || message.includes("not found") || message.includes("does not exist");
}

class SupabaseStorageMt5SyncRepository implements Mt5SyncRepository {
  private bucketReady: Promise<void> | null = null;

  constructor(private client: SupabaseClient) {}

  private async ensureBucket() {
    this.bucketReady ??= (async () => {
      const { error } = await this.client.storage.createBucket(MT5_STORAGE_BUCKET, {
        public: false,
      });

      if (!error) {
        return;
      }

      const { error: getError } = await this.client.storage.getBucket(MT5_STORAGE_BUCKET);

      if (getError && !isMissingStorageObjectError(error)) {
        throw error;
      }
    })();

    await this.bucketReady;
  }

  private storage() {
    return this.client.storage.from(MT5_STORAGE_BUCKET);
  }

  private async uploadJson(path: string, value: unknown) {
    await this.ensureBucket();
    const { error } = await this.storage().upload(path, JSON.stringify(value), {
      contentType: "application/json",
      upsert: true,
    });

    if (error) {
      throw error;
    }
  }

  private async downloadJson<T>(path: string): Promise<T | null> {
    await this.ensureBucket();
    const { data, error } = await this.storage().download(path);

    if (error) {
      if (isMissingStorageObjectError(error)) {
        return null;
      }

      throw error;
    }

    return JSON.parse(await data.text()) as T;
  }

  private async listJson<T>(prefix: string, limit = 1000) {
    await this.ensureBucket();
    const { data, error } = await this.storage().list(prefix, {
      limit,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) {
      if (isMissingStorageObjectError(error)) {
        return [];
      }

      throw error;
    }

    const files = (data ?? []).filter((item) => item.name.endsWith(".json"));
    const values: T[] = [];

    for (const item of files) {
      const value = await this.downloadJson<T>(`${prefix}/${item.name}`);

      if (value) {
        values.push(value);
      }
    }

    return values;
  }

  private connectorPath(connector: Pick<Mt5Connector, "id" | "userId">) {
    return `connectors/${sanitizeStorageSegment(connector.userId)}/${connector.id}.json`;
  }

  async createConnector(options: CreateConnectorOptions) {
    const now = new Date().toISOString();
    const connector: StorageMt5Connector = {
      id: randomUUID(),
      userId: options.userId,
      name: options.name,
      tokenHash: hashMt5ConnectorToken(options.token),
      tokenPreview: buildMt5ConnectorTokenPreview(options.token),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: null,
    };

    await Promise.all([
      this.uploadJson(this.connectorPath(connector), connector),
      this.uploadJson(`connector-index/${connector.id}.json`, connector),
      this.uploadJson(`tokens/${connector.tokenHash}.json`, connector),
    ]);

    return connectorWithoutHash(connector);
  }

  async listConnectors(userId: string) {
    const connectors = await this.listJson<StorageMt5Connector>(
      `connectors/${sanitizeStorageSegment(userId)}`,
    );

    return connectors
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .map(connectorWithoutHash);
  }

  async findConnectorByTokenHash(tokenHash: string) {
    const connector = await this.downloadJson<StorageMt5Connector>(`tokens/${tokenHash}.json`);

    return connector ? connectorWithoutHash(connector) : null;
  }

  async markConnectorSeen(connectorId: string, lastSeenAt: Date) {
    const connector = await this.downloadJson<StorageMt5Connector>(
      `connector-index/${connectorId}.json`,
    );

    if (!connector) {
      return;
    }

    const updated = {
      ...connector,
      lastSeenAt: lastSeenAt.toISOString(),
      updatedAt: lastSeenAt.toISOString(),
    };

    await Promise.all([
      this.uploadJson(this.connectorPath(updated), updated),
      this.uploadJson(`connector-index/${updated.id}.json`, updated),
      this.uploadJson(`tokens/${updated.tokenHash}.json`, updated),
    ]);
  }

  async saveSnapshot(payload: Mt5SnapshotPayload, options?: SaveSnapshotOptions) {
    const snapshot = buildStoredSnapshot(payload, options);
    const userSegment = sanitizeStorageSegment(snapshot.userId);
    const receivedAtMs = new Date(snapshot.receivedAt).getTime();
    const snapshotPath = `snapshots/${userSegment}/${receivedAtMs}-${snapshot.id}.json`;

    await Promise.all([
      this.uploadJson(snapshotPath, snapshot),
      this.uploadJson(`latest/${userSegment}.json`, snapshot),
    ]);

    return snapshot;
  }

  async getLatestSnapshot(options?: { userId?: string }) {
    return this.downloadJson<Mt5StoredSnapshot>(
      `latest/${sanitizeStorageSegment(options?.userId)}.json`,
    );
  }

  async getSnapshotHistory(options?: { limit?: number; connectionKey?: string; userId?: string }) {
    const limit = clampHistoryLimit(options?.limit);
    const snapshots = await this.listJson<Mt5StoredSnapshot>(
      `snapshots/${sanitizeStorageSegment(options?.userId)}`,
      1000,
    );

    return snapshots
      .filter((snapshot) =>
        options?.connectionKey ? snapshot.connectionKey === options.connectionKey : true,
      )
      .sort(
        (first, second) =>
          new Date(second.receivedAt).getTime() - new Date(first.receivedAt).getTime(),
      )
      .slice(0, limit);
  }
}

class SupabaseMt5SyncRepository implements Mt5SyncRepository {
  private client = getSupabaseServiceClient();
  private storageFallback = new SupabaseStorageMt5SyncRepository(this.client);

  async createConnector(options: CreateConnectorOptions) {
    const { data, error } = await this.client
      .from("mt5_connectors")
      .insert({
        user_id: options.userId,
        name: options.name,
        token_hash: hashMt5ConnectorToken(options.token),
        token_preview: buildMt5ConnectorTokenPreview(options.token),
      })
      .select("*")
      .single();

    if (error) {
      if (isMissingMt5TableError(error)) {
        return this.storageFallback.createConnector(options);
      }

      throw error;
    }

    return mapSupabaseConnector(data as Record<string, unknown>);
  }

  async listConnectors(userId: string) {
    const { data, error } = await this.client
      .from("mt5_connectors")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingMt5TableError(error)) {
        return this.storageFallback.listConnectors(userId);
      }

      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapSupabaseConnector);
  }

  async findConnectorByTokenHash(tokenHash: string) {
    const { data, error } = await this.client
      .from("mt5_connectors")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      if (isMissingMt5TableError(error)) {
        return this.storageFallback.findConnectorByTokenHash(tokenHash);
      }

      return null;
    }

    if (!data) {
      return null;
    }

    return mapSupabaseConnector(data as Record<string, unknown>);
  }

  async markConnectorSeen(connectorId: string, lastSeenAt: Date) {
    const { error } = await this.client
      .from("mt5_connectors")
      .update({ last_seen_at: lastSeenAt.toISOString() })
      .eq("id", connectorId);

    if (error && isMissingMt5TableError(error)) {
      await this.storageFallback.markConnectorSeen(connectorId, lastSeenAt);
    }
  }

  async saveSnapshot(payload: Mt5SnapshotPayload, options?: SaveSnapshotOptions) {
    const snapshot = buildStoredSnapshot(payload, options);
    const { data, error } = await this.client
      .from("mt5_sync_snapshots")
      .insert({
        connection_key: snapshot.connectionKey,
        connector_id: snapshot.connectorId,
        account_login: snapshot.accountLogin,
        server: snapshot.server,
        user_id: snapshot.userId,
        received_at: snapshot.receivedAt,
        payload: snapshot.payload,
      })
      .select("*")
      .single();

    if (error) {
      if (isMissingMt5TableError(error)) {
        return this.storageFallback.saveSnapshot(payload, options);
      }

      throw error;
    }

    return mapSupabaseSnapshot(data as Record<string, unknown>);
  }

  async getLatestSnapshot(options?: { userId?: string }) {
    let query = this.client
      .from("mt5_sync_snapshots")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(1);

    if (options?.userId) {
      query = query.eq("user_id", options.userId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      if (isMissingMt5TableError(error)) {
        return this.storageFallback.getLatestSnapshot(options);
      }

      return null;
    }

    if (!data) {
      return null;
    }

    return mapSupabaseSnapshot(data as Record<string, unknown>);
  }

  async getSnapshotHistory(options?: { limit?: number; connectionKey?: string; userId?: string }) {
    let query = this.client
      .from("mt5_sync_snapshots")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(clampHistoryLimit(options?.limit));

    if (options?.connectionKey) {
      query = query.eq("connection_key", options.connectionKey);
    }

    if (options?.userId) {
      query = query.eq("user_id", options.userId);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingMt5TableError(error)) {
        return this.storageFallback.getSnapshotHistory(options);
      }

      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapSupabaseSnapshot);
  }
}

function getFirestoreReceivedAt(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString();
  }

  return new Date(0).toISOString();
}

function mapFirestoreSnapshot(id: string, data: Record<string, unknown>): Mt5StoredSnapshot {
  return {
    id,
    connectorId: data.connectorId ? String(data.connectorId) : null,
    userId: data.userId ? String(data.userId) : null,
    connectionKey: String(data.connectionKey),
    accountLogin: String(data.accountLogin),
    server: String(data.server),
    receivedAt: getFirestoreReceivedAt(data.receivedAt),
    payload: data.payload as Mt5SnapshotPayload,
  };
}

function mapFirestoreConnector(id: string, data: Record<string, unknown>): Mt5Connector {
  return {
    id,
    userId: String(data.userId),
    name: String(data.name),
    tokenPreview: String(data.tokenPreview),
    createdAt: getFirestoreReceivedAt(data.createdAt),
    updatedAt: getFirestoreReceivedAt(data.updatedAt),
    lastSeenAt: data.lastSeenAt ? getFirestoreReceivedAt(data.lastSeenAt) : null,
  };
}

class FirebaseMt5SyncRepository implements Mt5SyncRepository {
  private db = getFirebaseAdminFirestore();

  private getSnapshotsCollection() {
    return this.db?.collection("mt5_sync_snapshots") ?? null;
  }

  private getLatestCollection() {
    return this.db?.collection("mt5_sync_latest") ?? null;
  }

  private getConnectorsCollection() {
    return this.db?.collection("mt5_connectors") ?? null;
  }

  async createConnector(options: CreateConnectorOptions) {
    const connectors = this.getConnectorsCollection();

    if (!connectors) {
      return createMemoryMt5SyncRepository().createConnector(options);
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const data = {
      userId: options.userId,
      name: options.name,
      tokenHash: hashMt5ConnectorToken(options.token),
      tokenPreview: buildMt5ConnectorTokenPreview(options.token),
      createdAt: now,
      updatedAt: now,
      lastSeenAt: null,
    };

    await connectors.doc(id).set(data);

    return mapFirestoreConnector(id, data);
  }

  async listConnectors(userId: string) {
    const connectors = this.getConnectorsCollection();

    if (!connectors) {
      return createMemoryMt5SyncRepository().listConnectors(userId);
    }

    const result = await connectors.where("userId", "==", userId).get();

    return result.docs
      .map((doc) => mapFirestoreConnector(doc.id, doc.data()))
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }

  async findConnectorByTokenHash(tokenHash: string) {
    const connectors = this.getConnectorsCollection();

    if (!connectors) {
      return createMemoryMt5SyncRepository().findConnectorByTokenHash(tokenHash);
    }

    const result = await connectors.where("tokenHash", "==", tokenHash).limit(1).get();
    const doc = result.docs[0];

    return doc ? mapFirestoreConnector(doc.id, doc.data()) : null;
  }

  async markConnectorSeen(connectorId: string, lastSeenAt: Date) {
    const connectors = this.getConnectorsCollection();

    if (!connectors) {
      await createMemoryMt5SyncRepository().markConnectorSeen(connectorId, lastSeenAt);
      return;
    }

    const lastSeenAtIso = lastSeenAt.toISOString();
    await connectors.doc(connectorId).update({
      lastSeenAt: lastSeenAtIso,
      updatedAt: lastSeenAtIso,
    });
  }

  async saveSnapshot(payload: Mt5SnapshotPayload, options?: SaveSnapshotOptions) {
    const snapshot = buildStoredSnapshot(payload, options);
    const snapshots = this.getSnapshotsCollection();
    const latest = this.getLatestCollection();

    if (!snapshots || !latest) {
      return createMemoryMt5SyncRepository().saveSnapshot(payload, options);
    }

    const data = {
      connectionKey: snapshot.connectionKey,
      connectorId: snapshot.connectorId,
      accountLogin: snapshot.accountLogin,
      server: snapshot.server,
      userId: snapshot.userId,
      receivedAt: snapshot.receivedAt,
      receivedAtMs: new Date(snapshot.receivedAt).getTime(),
      payload: snapshot.payload,
    };

    await snapshots.doc(snapshot.id).set(data);
    await latest.doc(snapshot.connectionKey).set({
      ...data,
      snapshotId: snapshot.id,
    });

    return snapshot;
  }

  async getLatestSnapshot(options?: { userId?: string }) {
    const snapshots = this.getSnapshotsCollection();

    if (!snapshots) {
      return createMemoryMt5SyncRepository().getLatestSnapshot();
    }

    let query: FirebaseFirestore.Query = snapshots.orderBy("receivedAtMs", "desc");

    if (options?.userId) {
      query = query.where("userId", "==", options.userId);
    }

    const result = await query.limit(1).get();
    const doc = result.docs[0];

    if (!doc) {
      return null;
    }

    return mapFirestoreSnapshot(doc.id, doc.data());
  }

  async getSnapshotHistory(options?: { limit?: number; connectionKey?: string; userId?: string }) {
    const snapshots = this.getSnapshotsCollection();

    if (!snapshots) {
      return createMemoryMt5SyncRepository().getSnapshotHistory(options);
    }

    let query: FirebaseFirestore.Query = snapshots.orderBy("receivedAtMs", "desc");

    if (options?.connectionKey) {
      query = query.where("connectionKey", "==", options.connectionKey);
    }

    if (options?.userId) {
      query = query.where("userId", "==", options.userId);
    }

    const result = await query.limit(clampHistoryLimit(options?.limit)).get();

    return result.docs.map((doc) => mapFirestoreSnapshot(doc.id, doc.data()));
  }
}

export function createMemoryMt5SyncRepository(): Mt5SyncRepository {
  return new MemoryMt5SyncRepository();
}

export function resetMt5MemoryStoreForTests() {
  global.__goldIntelMt5MemoryStore = {
    connectors: [],
    snapshots: [],
  };
}

export function getMt5SyncRepository(): Mt5SyncRepository {
  if (isFirebaseConfigured) {
    return new FirebaseMt5SyncRepository();
  }

  if (isSupabaseConfigured) {
    return new SupabaseMt5SyncRepository();
  }

  return createMemoryMt5SyncRepository();
}
