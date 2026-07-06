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

  console.log("Searching for Ashik's orders...");
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select(`
      id, status, type, customer_name, customer_phone, created_at, created_by,
      items:order_items(*, table:tables(name)),
      bookings(*)
    `)
    .eq("customer_phone", "9566036115")
    .order("created_at", { ascending: false });

  if (ordersErr) {
    console.error("Error fetching orders:", ordersErr);
    return;
  }

  console.log("Found orders & sessions:", JSON.stringify(orders, null, 2));
}

main().catch(console.error);
