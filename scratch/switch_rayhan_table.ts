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

  console.log("Finding all tables named Medium Table 2...");
  const { data: tables, error: tableErr } = await supabase
    .from("tables")
    .select("id, name, location_id, location:locations(name)")
    .eq("name", "Medium Table 2");

  if (tableErr || !tables) {
    console.error("Could not find tables:", tableErr);
    return;
  }

  console.log("Found tables:", JSON.stringify(tables, null, 2));

  // The order ID is 934c941c-c8a8-48b7-9b91-2137bb7d24e5
  // Let's get Rayhan's order location
  const { data: order } = await supabase
    .from("orders")
    .select("location_id")
    .eq("id", "934c941c-c8a8-48b7-9b91-2137bb7d24e5")
    .single();

  if (!order) {
    console.error("Could not find Rayhan's order");
    return;
  }

  console.log(`Rayhan's order location ID: ${order.location_id}`);

  const correctTable = tables.find(t => t.location_id === order.location_id);
  if (!correctTable) {
    console.error("Could not find Medium Table 2 for the order's location");
    return;
  }

  console.log(`Matching table: ${correctTable.name} (ID: ${correctTable.id}) at location: ${correctTable.location?.name}`);

  const orderItemId = "1d0623c7-675c-4ec8-bcde-2451d17ab49c";

  console.log(`Updating order item ${orderItemId} to use table_id: ${correctTable.id}...`);
  const { error: updateErr } = await supabase
    .from("order_items")
    .update({
      table_id: correctTable.id
    })
    .eq("id", orderItemId);

  if (updateErr) {
    console.error("Error updating order item:", updateErr);
    return;
  }

  console.log("Table successfully switched to Medium Table 2 for Rayhan!");
}

main().catch(console.error);
