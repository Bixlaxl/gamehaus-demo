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

  const tableId = "7166a6ec-6fa0-4362-afa9-bba686b17256"; // American Pool Table (Gamehaus)

  console.log("Fetching all order items on American Pool Table (Gamehaus) for today...");
  const { data: items } = await supabase
    .from("order_items")
    .select(`
      id, status, actual_start, expected_end, scheduled_start, scheduled_end, is_deleted, created_at,
      order:orders(id, customer_name, customer_phone, status, type)
    `)
    .eq("table_id", tableId)
    .gte("created_at", "2026-07-06T00:00:00+00:00");

  console.log("All Items:", JSON.stringify(items, null, 2));
}

main().catch(console.error);
