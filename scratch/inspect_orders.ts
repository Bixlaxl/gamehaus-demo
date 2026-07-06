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
    console.error("Missing Supabase credentials in env");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get orders
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, status, total_amount, subtotal, customer_name, customer_phone, items:order_items(id, status, table_id), extras:order_extras(id)");

  if (error) {
    console.error("Error fetching orders:", error.message);
    return;
  }

  console.log(`Total orders in DB: ${orders?.length}`);
  
  const stats = {
    total: orders?.length || 0,
    finalized: 0,
    hasItems: 0,
    hasExtras: 0,
    hasBoth: 0,
    hasNeither: 0,
  };

  for (const o of orders || []) {
    if (o.status === "finalized") stats.finalized++;
    const itemsCount = o.items?.length || 0;
    const extrasCount = o.extras?.length || 0;

    if (itemsCount > 0) stats.hasItems++;
    if (extrasCount > 0) stats.hasExtras++;
    if (itemsCount > 0 && extrasCount > 0) stats.hasBoth++;
    if (itemsCount === 0 && extrasCount === 0) stats.hasNeither++;
  }

  console.log("=== ORDERS DIAGNOSTICS ===");
  console.log(JSON.stringify(stats, null, 2));

  // Print 5 sample orders that have neither items nor extras
  const neitherOrders = orders?.filter(o => (o.items?.length || 0) === 0 && (o.extras?.length || 0) === 0).slice(0, 5);
  console.log("=== SAMPLE ORDERS WITH NEITHER ITEMS NOR EXTRAS ===");
  console.log(JSON.stringify(neitherOrders, null, 2));
}

main().catch(console.error);
