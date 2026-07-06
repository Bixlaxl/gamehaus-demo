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

  // Duplicate / old restored items to cancel
  const oldOrderId = "7f53eef1-b0ef-4b2e-922e-3ccc93d9e97d";
  const oldOrderItemId = "b3954013-885c-43db-97a2-81da369060bb";
  const oldBookingId = "8e72a751-2af3-4f40-b34a-6dfc839a90e2";

  // Active walk-in session to adjust
  const activeOrderItemId = "78a6dbf0-e1cb-4cc9-9229-7fa796c65098";

  console.log("Cancelling the duplicate restored order/booking...");
  await supabase.from("orders").update({ status: "cancelled" }).eq("id", oldOrderId);
  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", oldBookingId);
  await supabase.from("order_items").update({ status: "cancelled" }).eq("id", oldOrderItemId);

  console.log("Adjusting Jalal's active walk-in session start and expected end to 17:00 - 19:00 IST...");
  const targetStart = "2026-07-06T11:30:00+00:00"; // 5:00 PM IST
  const targetEnd = "2026-07-06T13:30:00+00:00";   // 7:00 PM IST

  const { error: activeErr } = await supabase
    .from("order_items")
    .update({
      actual_start: targetStart,
      expected_end: targetEnd
    })
    .eq("id", activeOrderItemId);

  if (activeErr) {
    console.error("Error updating active order item:", activeErr);
    return;
  }

  console.log("Successfully adjusted Jalal's running session and cleaned up duplicates!");
}

main().catch(console.error);
