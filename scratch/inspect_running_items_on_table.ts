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

  console.log("Querying running order items on table bfaabdcf-1e39-43e1-a866-48ccc65e4260...");
  const { data: items, error } = await supabase
    .from("order_items")
    .select(`
      id, status, table_id, actual_start, expected_end, scheduled_start, scheduled_end,
      order:orders(id, customer_name, customer_phone, status)
    `)
    .eq("table_id", "bfaabdcf-1e39-43e1-a866-48ccc65e4260")
    .eq("status", "running");

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Running items on table:", JSON.stringify(items, null, 2));
}

main().catch(console.error);
