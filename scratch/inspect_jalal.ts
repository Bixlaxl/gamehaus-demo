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

  console.log("Searching for Jalal's bookings today (9176107423)...");
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, status, scheduled_start, scheduled_end, order_id, order_item_id,
      order:orders(id, customer_name, customer_phone, status, type, advance_paid),
      order_item:order_items(table_id, table:tables(name))
    `)
    .gte("scheduled_start", "2026-07-06T00:00:00+00:00")
    .lt("scheduled_start", "2026-07-06T23:59:59+00:00");

  if (error) {
    console.error("Error:", error);
    return;
  }

  const jalalBookings = bookings?.filter((b) => {
    const name = (b.order as any)?.customer_name ?? "";
    const phone = (b.order as any)?.customer_phone ?? "";
    return name.toLowerCase().includes("jalal") || phone.includes("9176107423");
  });

  console.log("Jalal Bookings:", JSON.stringify(jalalBookings, null, 2));
}

main().catch(console.error);
