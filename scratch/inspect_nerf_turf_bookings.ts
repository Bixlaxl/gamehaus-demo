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

  console.log("Finding Amerian Pool Table at Nerf Turf...");
  const { data: table } = await supabase
    .from("tables")
    .select("id, name, location_id, location:locations(name)")
    .eq("name", "Amerian Pool Table")
    .maybeSingle();

  if (!table) {
    console.error("Could not find Amerian Pool Table");
    return;
  }

  console.log(`Found Amerian Pool Table ID: ${table.id}`);

  console.log("\nFetching bookings on this table today...");
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id, status, scheduled_start, scheduled_end,
      order_item:order_items!inner(table_id),
      order:orders(customer_name, customer_phone, status)
    `)
    .in("status", ["confirmed", "checked_in"])
    .eq("order_items.table_id", table.id);

  console.log("Bookings on Amerian Pool Table (Nerf Turf):", JSON.stringify(bookings, null, 2));
}

main().catch(console.error);
