import { createClient } from "@supabase/supabase-js";
import { calculateBill } from "../lib/billing/engine";
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

  const orderId = "5fce199f-91ad-4392-8386-64770b5dc6ae";
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      *,
      items:order_items(*, table:tables(*)),
      extras:order_extras(*)
    `)
    .eq("id", orderId)
    .single();

  if (error || !order) {
    console.error("Error fetching order:", error);
    return;
  }

  console.log("Order structure:");
  console.log("Advance Paid:", order.advance_paid);
  console.log("Discount Amount:", order.discount_amount);
  
  const activeItems = order.items.filter((i: any) => !i.is_deleted && i.status !== "cancelled");
  const activeExtras = order.extras.filter((e: any) => !e.is_deleted);
  
  console.log("\nActive Items details:");
  activeItems.forEach((item: any) => {
    console.log(`- Table: ${item.table?.name}`);
    console.log(`  status: ${item.status}`);
    console.log(`  actual_start: ${item.actual_start}`);
    console.log(`  expected_end: ${item.expected_end}`);
    console.log(`  scheduled_start: ${item.scheduled_start}`);
    console.log(`  scheduled_end: ${item.scheduled_end}`);
    console.log(`  rate_per_hour: ${item.rate_per_hour}`);
  });

  const now = new Date();
  const bill = calculateBill(activeItems, activeExtras, now, null, order.advance_paid ?? 0, order.discount_amount ?? 0);
  console.log("\nBill Output:");
  console.log(JSON.stringify(bill, null, 2));
}

main().catch(console.error);
