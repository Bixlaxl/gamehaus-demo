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

  const { data: profiles, error } = await supabase
    .from("customer_profiles")
    .select("phone, name, visit_count, total_spent, last_visit_at")
    .eq("visit_count", 1)
    .limit(10);

  if (error) {
    console.error("Error fetching profiles:", error.message);
    return;
  }

  console.log("=== SAMPLE PROFILES WITH 1 VISIT ===");
  console.log(JSON.stringify(profiles, null, 2));

  // Get total count of profiles with 1 visit
  const { count, error: countErr } = await supabase
    .from("customer_profiles")
    .select("*", { count: "exact", head: true })
    .eq("visit_count", 1);
    
  console.log(`Total profiles with 1 visit in DB: ${count}`);
}

main().catch(console.error);
