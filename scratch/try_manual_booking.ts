import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Load env
const envContent = fs.existsSync("/Users/ahmedbilal/Desktop/Gamehaus/.env.local") ? fs.readFileSync("/Users/ahmedbilal/Desktop/Gamehaus/.env.local", "utf-8") : "";
const processEnv: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    processEnv[key] = val;
  }
}

const supabaseUrl = processEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = processEnv.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const tableId = "7166a6ec-6fa0-4362-afa9-bba686b17256"; // American Pool Table
  
  // 8:30 PM - 9:30 PM IST -> 15:00 - 16:00 UTC
  const reqStart = "2026-07-06T15:00:00.000Z";
  const reqEnd = "2026-07-06T16:00:00.000Z";

  console.log(`Checking conflict for ${reqStart} to ${reqEnd}...`);

  const [{ data: existingItems }, { data: existingBookings }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, table_id, actual_start, expected_end, scheduled_start, scheduled_end, status")
      .eq("table_id", tableId)
      .eq("is_deleted", false)
      .in("status", ["running", "scheduled"]),
    supabase
      .from("bookings")
      .select("scheduled_start, scheduled_end, order_item:order_items!inner(id, table_id)")
      .eq("status", "confirmed")
      .eq("order_items.table_id", tableId),
  ]);

  const startMs = new Date(reqStart).getTime();
  const endMs = new Date(reqEnd).getTime();

  const overlaps = (aS: number, aE: number, bS: number, bE: number) => aS < bE && aE > bS;
  const processedItemIds = new Set<string>();
  let isConflict = false;

  console.log("\nChecking running/scheduled items:");
  for (const ex of (existingItems ?? [])) {
    const exS = ex.status === "running" ? ex.actual_start : ex.scheduled_start;
    const exE = ex.status === "running" ? ex.expected_end : ex.scheduled_end;
    if (exS && exE) {
      const exSMs = new Date(exS).getTime();
      const exEMs = new Date(exE).getTime();
      const clash = overlaps(startMs, endMs, exSMs, exEMs);
      console.log(`- Item ${ex.id} (${ex.status}): ${exS} to ${exE} -> clash: ${clash}`);
      if (clash) {
        isConflict = true;
        processedItemIds.add(ex.id);
      }
    }
  }

  console.log("\nChecking confirmed bookings:");
  for (const b of (existingBookings ?? [])) {
    if (!b.scheduled_start || !b.scheduled_end) continue;
    const bSMs = new Date(b.scheduled_start).getTime();
    const bEMs = new Date(b.scheduled_end).getTime();
    const clash = overlaps(startMs, endMs, bSMs, bEMs);
    console.log(`- Booking ${b.id}: ${b.scheduled_start} to ${b.scheduled_end} -> clash: ${clash}`);
    const oi = b.order_item as unknown as { id: string; table_id: string } | null;
    if (!oi) continue;
    if (oi.id && processedItemIds.has(oi.id)) continue;
    if (clash) {
      isConflict = true;
    }
  }

  console.log(`\nFinal Conflict Result: ${isConflict}`);
}

main().catch(console.error);
