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

  const itemId = "98886b17-e7c9-43d7-ab18-346ba35737b7"; // Medium Table 1

  console.log(`Reverting Medium Table 1 session (${itemId}) to scheduled...`);
  const { error } = await supabase
    .from("order_items")
    .update({
      status: "scheduled",
      actual_start: null,
      actual_end: null,
      expected_end: null
    })
    .eq("id", itemId);

  if (error) {
    console.error("Error updating order item:", error);
    return;
  }

  console.log("Medium Table 1 session successfully reverted to scheduled!");
}

main().catch(console.error);
