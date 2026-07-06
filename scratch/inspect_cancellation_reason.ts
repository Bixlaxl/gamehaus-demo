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

  console.log("Inspecting all Devesh orders...");
  const { data: devesh, error: err1 } = await supabase
    .from("orders")
    .select(`
      id, status, type, customer_name, customer_phone, created_at, created_by, advance_paid,
      bookings(*),
      payments(*)
    `)
    .eq("customer_phone", "7806961406");

  if (err1) {
    console.error("Devesh error:", err1);
  } else {
    console.log("Devesh details:", JSON.stringify(devesh, null, 2));
  }
}

main().catch(console.error);
