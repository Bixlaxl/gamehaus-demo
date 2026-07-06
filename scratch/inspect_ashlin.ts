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

  console.log("Searching for Ashlin's bookings today (2026-07-06)...");
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, status, scheduled_start, scheduled_end, order_id, order_item_id,
      order:orders(
        id, customer_name, customer_phone, status, type, advance_paid, total_amount,
        payments(id, amount, method, status, razorpay_payment_id)
      )
    `);

  if (error) {
    console.error("Error:", error);
    return;
  }

  const ashlinBookings = bookings?.filter((b) => {
    const phone = (b.order as any)?.customer_phone ?? "";
    return phone.includes("6380001533");
  });

  console.log("Ashlin's Bookings and Payments:", JSON.stringify(ashlinBookings, null, 2));

  console.log("\nSearching for Madhavan's bookings today...");
  const { data: madhavan, error: err2 } = await supabase
    .from("bookings")
    .select(`
      id, status, scheduled_start, scheduled_end, order_id,
      order:orders(id, customer_name, customer_phone, status, type, advance_paid)
    `)
    .gte("scheduled_start", "2026-07-06T00:00:00+00:00")
    .order("scheduled_start", { ascending: false });

  if (err2) {
    console.error("Error2:", err2);
    return;
  }

  const madhavanBookings = madhavan?.filter(b => (b.order as any)?.customer_name?.toLowerCase().includes("madhavan"));
  console.log("Madhavan Bookings:", JSON.stringify(madhavanBookings, null, 2));
}

main().catch(console.error);
