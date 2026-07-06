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

  const { data: minMax, error } = await supabase
    .from("orders")
    .select("finalized_at")
    .eq("status", "finalized")
    .order("finalized_at", { ascending: true });

  if (error) {
    console.error("Error:", error);
    return;
  }

  const validDates = minMax?.map(o => o.finalized_at).filter(Boolean) || [];
  if (validDates.length > 0) {
    console.log(`Earliest finalized order: ${validDates[0]}`);
    console.log(`Latest finalized order: ${validDates[validDates.length - 1]}`);
    console.log(`Total finalized orders: ${validDates.length}`);
  } else {
    console.log("No finalized orders with dates found.");
  }
}

main().catch(console.error);
