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

  // Get last campaign
  const { data: campaigns } = await supabase
    .from("whatsapp_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!campaigns || campaigns.length === 0) {
    console.log("No campaigns found");
    return;
  }

  const campaign = campaigns[0];
  console.log(`Resetting campaign: ${campaign.name} (${campaign.id})`);

  // Update campaign status back to sending
  await supabase
    .from("whatsapp_campaigns")
    .update({ status: "sending", sent_count: 0, failed_count: 0 })
    .eq("id", campaign.id);

  // Reset all failed queue items to pending
  await supabase
    .from("whatsapp_queue")
    .update({ status: "pending", error_message: null })
    .eq("campaign_id", campaign.id);

  console.log("Campaign reset successful. Triggering queue worker locally...");
  
  // Trigger worker locally
  const res = await fetch("http://localhost:3001/api/owner/whatsapp/queue-worker", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId: campaign.id })
  });

  const body = await res.json();
  console.log("Worker trigger result:", body);
}

main().catch(console.error);
