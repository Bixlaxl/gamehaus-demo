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
  const targetStart = "2026-07-06T11:00:00+00:00"; // 4:30 PM IST

  console.log(`Setting actual_start to 16:30 IST (${targetStart}) for item ${itemId}...`);
  const { error } = await supabase
    .from("order_items")
    .update({
      actual_start: targetStart
    })
    .eq("id", itemId);

  if (error) {
    console.error("Error updating actual_start:", error);
    return;
  }

  console.log("Actual start time updated successfully!");
}

main().catch(console.error);
