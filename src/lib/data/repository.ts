import { createClient } from "@supabase/supabase-js";
import { FieldValue } from "firebase-admin/firestore";

import { buildDemoSnapshot } from "@/lib/data/demo-snapshot";
import { env, isFirebaseConfigured, isSupabaseConfigured } from "@/lib/env";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { inferCalendarEventType } from "@/lib/calendar-filters";
import { buildCalendarEventKey, getCalendarActualStatus } from "@/lib/calendar-history";
import type { DashboardSnapshot, EconomicCalendarEvent } from "@/lib/types";

type MemoryStore = {
  snapshot: DashboardSnapshot;
};

declare global {
  var __goldIntelMemoryStore: MemoryStore | undefined;
}

function getMemoryStore() {
  global.__goldIntelMemoryStore ??= {
    snapshot: buildDemoSnapshot(),
  };

  return global.__goldIntelMemoryStore;
}

function normalizeSnapshot(snapshot: DashboardSnapshot): DashboardSnapshot {
  const demo = buildDemoSnapshot();
  const seenCalendarIds = new Map<string, number>();
  const calendarEvents = (snapshot.calendarEvents ?? demo.calendarEvents).map((event) => {
    const duplicateCount = seenCalendarIds.get(event.id) ?? 0;
    seenCalendarIds.set(event.id, duplicateCount + 1);

    return {
      ...event,
      id: duplicateCount ? `${event.id}-${duplicateCount + 1}` : event.id,
      calendarKey:
        (event as Partial<EconomicCalendarEvent>).calendarKey ?? buildCalendarEventKey(event),
      actualStatus:
        (event as Partial<EconomicCalendarEvent>).actualStatus ?? getCalendarActualStatus(event),
      eventType:
        (event as Partial<EconomicCalendarEvent>).eventType ?? inferCalendarEventType(event.title),
    };
  });

  return {
    ...demo,
    ...snapshot,
    calendarEvents,
    cotSeries: snapshot.cotSeries ?? demo.cotSeries,
    macroSeries: snapshot.macroSeries ?? demo.macroSeries,
    news: snapshot.news ?? demo.news,
    signalHistory: snapshot.signalHistory ?? demo.signalHistory,
    syncRuns: snapshot.syncRuns ?? demo.syncRuns,
    staleFlags: {
      ...demo.staleFlags,
      ...snapshot.staleFlags,
    },
  };
}

interface DashboardRepository {
  getSnapshot(): Promise<DashboardSnapshot>;
  saveSnapshot(snapshot: DashboardSnapshot): Promise<void>;
}

class MemoryDashboardRepository implements DashboardRepository {
  async getSnapshot() {
    const store = getMemoryStore();
    store.snapshot = normalizeSnapshot(store.snapshot);
    return store.snapshot;
  }

  async saveSnapshot(snapshot: DashboardSnapshot) {
    getMemoryStore().snapshot = normalizeSnapshot(snapshot);
  }
}

class SupabaseDashboardRepository implements DashboardRepository {
  private client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  async getSnapshot() {
    const { data, error } = await this.client
      .from("gold_dashboard_snapshots")
      .select("payload")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.payload) {
      return normalizeSnapshot(getMemoryStore().snapshot);
    }

    return normalizeSnapshot(data.payload as DashboardSnapshot);
  }

  async saveSnapshot(snapshot: DashboardSnapshot) {
    const { error } = await this.client.from("gold_dashboard_snapshots").insert({
      payload: snapshot,
    });

    if (error) {
      getMemoryStore().snapshot = normalizeSnapshot(snapshot);
    }
  }
}

class FirebaseDashboardRepository implements DashboardRepository {
  private db = getFirebaseAdminFirestore();

  private getSnapshotRef() {
    return this.db?.collection("gold_dashboard_snapshots").doc("latest") ?? null;
  }

  async getSnapshot() {
    const snapshotRef = this.getSnapshotRef();

    if (!snapshotRef) {
      return normalizeSnapshot(getMemoryStore().snapshot);
    }

    try {
      const doc = await snapshotRef.get();
      const payload = doc.exists ? doc.data()?.payload : null;

      if (!payload) {
        return normalizeSnapshot(getMemoryStore().snapshot);
      }

      return normalizeSnapshot(payload as DashboardSnapshot);
    } catch {
      return normalizeSnapshot(getMemoryStore().snapshot);
    }
  }

  async saveSnapshot(snapshot: DashboardSnapshot) {
    const normalized = normalizeSnapshot(snapshot);
    const snapshotRef = this.getSnapshotRef();

    if (!snapshotRef) {
      getMemoryStore().snapshot = normalized;
      return;
    }

    try {
      await snapshotRef.set({
        payload: normalized,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch {
      getMemoryStore().snapshot = normalized;
    }
  }
}

export function getDashboardRepository(): DashboardRepository {
  if (isFirebaseConfigured) {
    return new FirebaseDashboardRepository();
  }

  if (isSupabaseConfigured) {
    return new SupabaseDashboardRepository();
  }

  return new MemoryDashboardRepository();
}
