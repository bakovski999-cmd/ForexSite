import { unstable_noStore as noStore } from "next/cache";

import { getDashboardSnapshot as getStoredDashboardSnapshot } from "@/lib/data/sync";

export async function loadDashboardSnapshot() {
  noStore();
  return getStoredDashboardSnapshot();
}
