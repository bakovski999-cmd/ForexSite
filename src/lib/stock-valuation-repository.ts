import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import { env, isFirebaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type { StockValuationInput } from "@/lib/stock-valuation";

export type SavedStockValuationAnalysis = {
  id: string;
  userId: string;
  ticker: string;
  companyName: string | null;
  title: string;
  latestFairValue: number | null;
  currentPrice: number | null;
  payload: StockValuationInput;
  createdAt: string;
  updatedAt: string;
};

export type SaveStockValuationAnalysisInput = {
  ticker: string;
  companyName?: string | null;
  title: string;
  latestFairValue?: number | null;
  currentPrice?: number | null;
  payload: StockValuationInput;
};

export type UpdateStockValuationAnalysisInput = Partial<SaveStockValuationAnalysisInput>;

export interface StockValuationRepository {
  listAnalyses(userId: string): Promise<SavedStockValuationAnalysis[]>;
  getAnalysis(userId: string, id: string): Promise<SavedStockValuationAnalysis | null>;
  createAnalysis(
    userId: string,
    input: SaveStockValuationAnalysisInput,
  ): Promise<SavedStockValuationAnalysis>;
  updateAnalysis(
    userId: string,
    id: string,
    input: UpdateStockValuationAnalysisInput,
  ): Promise<SavedStockValuationAnalysis | null>;
  deleteAnalysis(userId: string, id: string): Promise<boolean>;
}

type StockValuationMemoryStore = {
  analyses: SavedStockValuationAnalysis[];
};

declare global {
  var __goldIntelStockValuationMemoryStore: StockValuationMemoryStore | undefined;
}

function getMemoryStore() {
  global.__goldIntelStockValuationMemoryStore ??= { analyses: [] };

  return global.__goldIntelStockValuationMemoryStore;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeTicker(ticker: string) {
  return ticker.trim().toUpperCase();
}

function normalizeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildAnalysis(
  userId: string,
  input: SaveStockValuationAnalysisInput,
): SavedStockValuationAnalysis {
  const now = nowIso();

  return {
    id: randomUUID(),
    userId,
    ticker: normalizeTicker(input.ticker),
    companyName: input.companyName?.trim() || null,
    title: input.title.trim() || `${normalizeTicker(input.ticker)} valuation`,
    latestFairValue: normalizeNumber(input.latestFairValue),
    currentPrice: normalizeNumber(input.currentPrice),
    payload: input.payload,
    createdAt: now,
    updatedAt: now,
  };
}

function sortNewestFirst(analyses: SavedStockValuationAnalysis[]) {
  return [...analyses].sort(
    (first, second) =>
      new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime(),
  );
}

class MemoryStockValuationRepository implements StockValuationRepository {
  async listAnalyses(userId: string) {
    return sortNewestFirst(
      getMemoryStore().analyses.filter((analysis) => analysis.userId === userId),
    );
  }

  async getAnalysis(userId: string, id: string) {
    return (
      getMemoryStore().analyses.find(
        (analysis) => analysis.userId === userId && analysis.id === id,
      ) ?? null
    );
  }

  async createAnalysis(userId: string, input: SaveStockValuationAnalysisInput) {
    const analysis = buildAnalysis(userId, input);
    const store = getMemoryStore();
    store.analyses = [analysis, ...store.analyses];

    return analysis;
  }

  async updateAnalysis(userId: string, id: string, input: UpdateStockValuationAnalysisInput) {
    const store = getMemoryStore();
    const existing = store.analyses.find(
      (analysis) => analysis.userId === userId && analysis.id === id,
    );

    if (!existing) {
      return null;
    }

    const updated: SavedStockValuationAnalysis = {
      ...existing,
      ticker: input.ticker ? normalizeTicker(input.ticker) : existing.ticker,
      companyName:
        input.companyName !== undefined
          ? input.companyName?.trim() || null
          : existing.companyName,
      title: input.title?.trim() || existing.title,
      latestFairValue:
        input.latestFairValue !== undefined
          ? normalizeNumber(input.latestFairValue)
          : existing.latestFairValue,
      currentPrice:
        input.currentPrice !== undefined ? normalizeNumber(input.currentPrice) : existing.currentPrice,
      payload: input.payload ?? existing.payload,
      updatedAt: nowIso(),
    };

    store.analyses = store.analyses.map((analysis) =>
      analysis.id === id && analysis.userId === userId ? updated : analysis,
    );

    return updated;
  }

  async deleteAnalysis(userId: string, id: string) {
    const store = getMemoryStore();
    const before = store.analyses.length;
    store.analyses = store.analyses.filter(
      (analysis) => !(analysis.userId === userId && analysis.id === id),
    );

    return store.analyses.length !== before;
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

function mapSupabaseRow(row: Record<string, unknown>): SavedStockValuationAnalysis {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ticker: String(row.ticker),
    companyName: row.company_name ? String(row.company_name) : null,
    title: String(row.title),
    latestFairValue: normalizeNumber(Number(row.latest_fair_value)),
    currentPrice: normalizeNumber(Number(row.current_price)),
    payload: row.payload as StockValuationInput,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function isMissingValuationTableError(error: unknown) {
  const record = error as { code?: string; message?: string } | null;
  const code = record?.code ?? "";
  const message = record?.message ?? "";

  return (
    code === "PGRST205" ||
    code === "42P01" ||
    (message.includes("schema cache") && message.includes("stock_valuation_analyses")) ||
    (message.includes("relation") &&
      message.includes("stock_valuation_analyses") &&
      message.includes("does not exist"))
  );
}

function isMissingStorageObjectError(error: unknown) {
  const record = error as { statusCode?: string | number; message?: string } | null;
  const statusCode = String(record?.statusCode ?? "");
  const message = record?.message?.toLowerCase() ?? "";

  return statusCode === "404" || message.includes("not found") || message.includes("does not exist");
}

const STOCK_VALUATION_STORAGE_BUCKET = "stock-valuations";

function sanitizeStorageSegment(value: string) {
  return Buffer.from(value || "_user", "utf8").toString("base64url");
}

class SupabaseStorageStockValuationRepository implements StockValuationRepository {
  private bucketReady: Promise<void> | null = null;

  constructor(private client: SupabaseClient) {}

  private async ensureBucket() {
    this.bucketReady ??= (async () => {
      const { error } = await this.client.storage.createBucket(STOCK_VALUATION_STORAGE_BUCKET, {
        public: false,
      });

      if (!error) {
        return;
      }

      const { error: getError } = await this.client.storage.getBucket(
        STOCK_VALUATION_STORAGE_BUCKET,
      );

      if (getError && !isMissingStorageObjectError(getError)) {
        throw getError;
      }
    })();

    await this.bucketReady;
  }

  private userPrefix(userId: string) {
    return `analyses/${sanitizeStorageSegment(userId)}`;
  }

  private analysisPath(userId: string, id: string) {
    return `${this.userPrefix(userId)}/${id}.json`;
  }

  private async uploadRecord(record: SavedStockValuationAnalysis) {
    await this.ensureBucket();
    const { error } = await this.client.storage
      .from(STOCK_VALUATION_STORAGE_BUCKET)
      .upload(this.analysisPath(record.userId, record.id), JSON.stringify(record), {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      throw error;
    }
  }

  private async downloadRecord(userId: string, id: string) {
    await this.ensureBucket();
    const { data, error } = await this.client.storage
      .from(STOCK_VALUATION_STORAGE_BUCKET)
      .download(this.analysisPath(userId, id));

    if (error) {
      if (isMissingStorageObjectError(error)) {
        return null;
      }

      throw error;
    }

    return JSON.parse(await data.text()) as SavedStockValuationAnalysis;
  }

  async listAnalyses(userId: string) {
    await this.ensureBucket();
    const { data, error } = await this.client.storage
      .from(STOCK_VALUATION_STORAGE_BUCKET)
      .list(this.userPrefix(userId), { limit: 200 });

    if (error) {
      if (isMissingStorageObjectError(error)) {
        return [];
      }

      throw error;
    }

    const records = await Promise.all(
      (data ?? [])
        .filter((item) => item.name.endsWith(".json"))
        .map((item) => this.downloadRecord(userId, item.name.replace(/\.json$/, ""))),
    );

    return sortNewestFirst(records.filter((record): record is SavedStockValuationAnalysis => Boolean(record)));
  }

  async getAnalysis(userId: string, id: string) {
    return this.downloadRecord(userId, id);
  }

  async createAnalysis(userId: string, input: SaveStockValuationAnalysisInput) {
    const analysis = buildAnalysis(userId, input);
    await this.uploadRecord(analysis);

    return analysis;
  }

  async updateAnalysis(userId: string, id: string, input: UpdateStockValuationAnalysisInput) {
    const existing = await this.downloadRecord(userId, id);

    if (!existing) {
      return null;
    }

    const updated: SavedStockValuationAnalysis = {
      ...existing,
      ticker: input.ticker ? normalizeTicker(input.ticker) : existing.ticker,
      companyName:
        input.companyName !== undefined
          ? input.companyName?.trim() || null
          : existing.companyName,
      title: input.title?.trim() || existing.title,
      latestFairValue:
        input.latestFairValue !== undefined
          ? normalizeNumber(input.latestFairValue)
          : existing.latestFairValue,
      currentPrice:
        input.currentPrice !== undefined ? normalizeNumber(input.currentPrice) : existing.currentPrice,
      payload: input.payload ?? existing.payload,
      updatedAt: nowIso(),
    };

    await this.uploadRecord(updated);

    return updated;
  }

  async deleteAnalysis(userId: string, id: string) {
    await this.ensureBucket();
    const { error } = await this.client.storage
      .from(STOCK_VALUATION_STORAGE_BUCKET)
      .remove([this.analysisPath(userId, id)]);

    if (error && !isMissingStorageObjectError(error)) {
      throw error;
    }

    return true;
  }
}

class SupabaseStockValuationRepository implements StockValuationRepository {
  private storageFallback: SupabaseStorageStockValuationRepository;

  constructor(private client: SupabaseClient) {
    this.storageFallback = new SupabaseStorageStockValuationRepository(client);
  }

  private async withFallback<T>(operation: () => Promise<T>, fallback: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isMissingValuationTableError(error)) {
        return fallback();
      }

      throw error;
    }
  }

  async listAnalyses(userId: string) {
    return this.withFallback(
      async () => {
        const { data, error } = await this.client
          .from("stock_valuation_analyses")
          .select("*")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false });

        if (error) {
          throw error;
        }

        return (data ?? []).map((row) => mapSupabaseRow(row));
      },
      () => this.storageFallback.listAnalyses(userId),
    );
  }

  async getAnalysis(userId: string, id: string) {
    return this.withFallback(
      async () => {
        const { data, error } = await this.client
          .from("stock_valuation_analyses")
          .select("*")
          .eq("user_id", userId)
          .eq("id", id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data ? mapSupabaseRow(data) : null;
      },
      () => this.storageFallback.getAnalysis(userId, id),
    );
  }

  async createAnalysis(userId: string, input: SaveStockValuationAnalysisInput) {
    return this.withFallback(
      async () => {
        const { data, error } = await this.client
          .from("stock_valuation_analyses")
          .insert({
            user_id: userId,
            ticker: normalizeTicker(input.ticker),
            company_name: input.companyName?.trim() || null,
            title: input.title.trim() || `${normalizeTicker(input.ticker)} valuation`,
            latest_fair_value: normalizeNumber(input.latestFairValue),
            current_price: normalizeNumber(input.currentPrice),
            payload: input.payload,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        return mapSupabaseRow(data);
      },
      () => this.storageFallback.createAnalysis(userId, input),
    );
  }

  async updateAnalysis(userId: string, id: string, input: UpdateStockValuationAnalysisInput) {
    return this.withFallback(
      async () => {
        const patch: Record<string, unknown> = { updated_at: nowIso() };

        if (input.ticker !== undefined) {
          patch.ticker = normalizeTicker(input.ticker);
        }
        if (input.companyName !== undefined) {
          patch.company_name = input.companyName?.trim() || null;
        }
        if (input.title !== undefined) {
          patch.title = input.title.trim();
        }
        if (input.latestFairValue !== undefined) {
          patch.latest_fair_value = normalizeNumber(input.latestFairValue);
        }
        if (input.currentPrice !== undefined) {
          patch.current_price = normalizeNumber(input.currentPrice);
        }
        if (input.payload !== undefined) {
          patch.payload = input.payload;
        }

        const { data, error } = await this.client
          .from("stock_valuation_analyses")
          .update(patch)
          .eq("user_id", userId)
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data ? mapSupabaseRow(data) : null;
      },
      () => this.storageFallback.updateAnalysis(userId, id, input),
    );
  }

  async deleteAnalysis(userId: string, id: string) {
    return this.withFallback(
      async () => {
        const { error } = await this.client
          .from("stock_valuation_analyses")
          .delete()
          .eq("user_id", userId)
          .eq("id", id);

        if (error) {
          throw error;
        }

        return true;
      },
      () => this.storageFallback.deleteAnalysis(userId, id),
    );
  }
}

class FirebaseStockValuationRepository implements StockValuationRepository {
  constructor(private firestore: NonNullable<ReturnType<typeof getFirebaseAdminFirestore>>) {}

  private collection() {
    return this.firestore.collection("stock_valuation_analyses");
  }

  async listAnalyses(userId: string) {
    const snapshot = await this.collection()
      .where("userId", "==", userId)
      .orderBy("updatedAt", "desc")
      .limit(200)
      .get();

    return snapshot.docs.map((doc) => doc.data() as SavedStockValuationAnalysis);
  }

  async getAnalysis(userId: string, id: string) {
    const doc = await this.collection().doc(id).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data() as SavedStockValuationAnalysis;

    return data.userId === userId ? data : null;
  }

  async createAnalysis(userId: string, input: SaveStockValuationAnalysisInput) {
    const analysis = buildAnalysis(userId, input);
    await this.collection().doc(analysis.id).set(analysis);

    return analysis;
  }

  async updateAnalysis(userId: string, id: string, input: UpdateStockValuationAnalysisInput) {
    const existing = await this.getAnalysis(userId, id);

    if (!existing) {
      return null;
    }

    const updated: SavedStockValuationAnalysis = {
      ...existing,
      ticker: input.ticker ? normalizeTicker(input.ticker) : existing.ticker,
      companyName:
        input.companyName !== undefined
          ? input.companyName?.trim() || null
          : existing.companyName,
      title: input.title?.trim() || existing.title,
      latestFairValue:
        input.latestFairValue !== undefined
          ? normalizeNumber(input.latestFairValue)
          : existing.latestFairValue,
      currentPrice:
        input.currentPrice !== undefined ? normalizeNumber(input.currentPrice) : existing.currentPrice,
      payload: input.payload ?? existing.payload,
      updatedAt: nowIso(),
    };

    await this.collection().doc(id).set(updated);

    return updated;
  }

  async deleteAnalysis(userId: string, id: string) {
    const existing = await this.getAnalysis(userId, id);

    if (!existing) {
      return false;
    }

    await this.collection().doc(id).delete();

    return true;
  }
}

export function createMemoryStockValuationRepository(): StockValuationRepository {
  return new MemoryStockValuationRepository();
}

export function resetStockValuationMemoryStoreForTests() {
  global.__goldIntelStockValuationMemoryStore = { analyses: [] };
}

export function getStockValuationRepository(): StockValuationRepository {
  const firestore = isFirebaseConfigured ? getFirebaseAdminFirestore() : null;

  if (firestore) {
    return new FirebaseStockValuationRepository(firestore);
  }

  if (isSupabaseConfigured) {
    return new SupabaseStockValuationRepository(getSupabaseServiceClient());
  }

  return createMemoryStockValuationRepository();
}
