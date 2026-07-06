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

  const orderId = "934c941c-c8a8-48b7-9b91-2137bb7d24e5";
  const orderItemId = "1d0623c7-675c-4ec8-bcde-2451d17ab49c";
  const bookingId = "3ffd6b71-93b1-4a26-93f0-4a6a76b3799b";

  console.log(`Restoring order ${orderId} to 'open'...`);
  const { error: err1 } = await supabase
    .from("orders")
    .update({ status: "open" })
    .eq("id", orderId);

  if (err1) {
    console.error("Error restoring order:", err1);
    return;
  }

  console.log(`Restoring order item ${orderItemId} to 'scheduled'...`);
  const { error: err2 } = await supabase
    .from("order_items")
    .update({ status: "scheduled" })
    .eq("id", orderItemId);

  if (err2) {
    console.error("Error restoring order item:", err2);
    return;
  }

  console.log(`Restoring booking ${bookingId} to 'confirmed'...`);
  const { error: err3 } = await supabase
    .from("bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId);

  if (err3) {
    console.error("Error restoring booking:", err3);
    return;
  }

  console.log("Rayhan's booking successfully restored in database!");
}

main().catch(console.error);
