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

  console.log("Searching for Rayhan's bookings...");
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, status, scheduled_start, scheduled_end, order_id, order_item_id,
      order:orders(id, customer_name, customer_phone, status, type)
    `)
    .eq("order.customer_phone", "8925083288")
    .order("scheduled_start", { ascending: false });

  if (error) {
    console.error("Error fetching bookings:", error);
    return;
  }

  console.log("Found bookings:", JSON.stringify(bookings, null, 2));
}

main().catch(console.error);
