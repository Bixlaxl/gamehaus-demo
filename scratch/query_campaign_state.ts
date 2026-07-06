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

  const { data: campaigns } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(3);
    
  console.log("=== CAMPAIGNS ===");
  console.log(JSON.stringify(campaigns, null, 2));

  if (campaigns && campaigns.length > 0) {
    const { data: queue } = await supabase
      .from("whatsapp_queue")
      .select("*")
      .eq("campaign_id", campaigns[0].id);
      
    console.log("=== QUEUE ITEMS ===");
    console.log(JSON.stringify(queue, null, 2));
  }
}

main().catch(console.error);
