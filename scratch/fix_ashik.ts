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

  const itemId = "40dc2167-5081-42a8-acc3-f744b93bb0b0"; // American Pool Table

  console.log(`Re-activating American Pool Table session (${itemId})...`);
  const { error } = await supabase
    .from("order_items")
    .update({
      status: "running",
      actual_end: null,
      final_amount: null
    })
    .eq("id", itemId);

  if (error) {
    console.error("Error updating order item:", error);
    return;
  }

  console.log("American Pool Table session successfully re-activated!");
}

main().catch(console.error);
