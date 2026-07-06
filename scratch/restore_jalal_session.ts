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

  const orderId = "7f53eef1-b0ef-4b2e-922e-3ccc93d9e97d";
  const orderItemId = "b3954013-885c-43db-97a2-81da369060bb";
  const bookingId = "8e72a751-2af3-4f40-b34a-6dfc839a90e2";

  const targetStart = "2026-07-06T11:30:00+00:00"; // 5:00 PM IST
  const targetEnd = "2026-07-06T13:30:00+00:00";   // 7:00 PM IST

  console.log("Restoring parent order to open...");
  const { error: err1 } = await supabase
    .from("orders")
    .update({ status: "open" })
    .eq("id", orderId);

  if (err1) {
    console.error("Error order:", err1);
    return;
  }

  console.log("Restoring booking to checked_in and setting time to 17:00 - 19:00...");
  const { error: err2 } = await supabase
    .from("bookings")
    .update({
      status: "checked_in",
      scheduled_start: targetStart,
      scheduled_end: targetEnd
    })
    .eq("id", bookingId);

  if (err2) {
    console.error("Error booking:", err2);
    return;
  }

  console.log("Restoring order item to running and setting times...");
  const { error: err3 } = await supabase
    .from("order_items")
    .update({
      status: "running",
      scheduled_start: targetStart,
      scheduled_end: targetEnd,
      actual_start: targetStart,
      expected_end: targetEnd,
      actual_end: null,
      final_amount: null
    })
    .eq("id", orderItemId);

  if (err3) {
    console.error("Error order item:", err3);
    return;
  }

  console.log("Jalal's session successfully restored and set to running at 17:00 - 19:00 IST!");
}

main().catch(console.error);
