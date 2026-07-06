import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Load environment variables manually from .env.local
const envContent = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf-8") : "";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || processEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || processEnv.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Connecting to Supabase...");

  // 1. Fetch all finalized orders to build a map of customer latest visit dates
  console.log("Fetching finalized orders to extract latest visit dates...");
  const { data: allOrders, error: ordersErr } = await supabase
    .from("orders")
    .select("customer_phone, finalized_at")
    .eq("status", "finalized");

  if (ordersErr) {
    console.error("Failed to fetch orders for date mapping:", ordersErr.message);
    process.exit(1);
  }

  const latestVisitMap = new Map<string, string>();
  for (const o of allOrders || []) {
    if (!o.customer_phone || !o.finalized_at) continue;
    const current = latestVisitMap.get(o.customer_phone);
    if (!current || new Date(o.finalized_at) > new Date(current)) {
      latestVisitMap.set(o.customer_phone, o.finalized_at);
    }
  }
  console.log(`Mapped latest visit dates for ${latestVisitMap.size} unique customer phone numbers.`);

  // 2. Delete 0-spend customers (total_spent = 0 and visit_count = 0)
  console.log("Deleting customers with 0 spending and 0 visits...");
  const { data: zeroSpendDeleted, error: deleteZeroError } = await supabase
    .from("customer_profiles")
    .delete()
    .eq("total_spent", 0)
    .eq("visit_count", 0)
    .select("phone, name");

  if (deleteZeroError) {
    console.error("Error deleting 0-spend customers:", deleteZeroError.message);
  } else {
    console.log(`Successfully deleted ${zeroSpendDeleted?.length || 0} customer profiles with 0 spending.`);
  }

  // 3. Fetch all active customer profiles
  console.log("Fetching customer profiles to identify legacy single-visit accounts...");
  let profiles: any[] = [];
  let offset = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("phone, name, visit_count, total_spent, last_visit_at")
      .range(offset, offset + size - 1);
      
    if (error) {
      console.error("Failed to fetch customer profiles:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    profiles = profiles.concat(data);
    if (data.length < size) break;
    offset += size;
  }

  // Define threshold date (1 year ago)
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  console.log(`One year ago threshold date: ${oneYearAgo.toISOString().split("T")[0]}`);

  // Identify profiles to group
  const legacyCustomers: any[] = [];
  const backfillUpdates: { phone: string; date: string }[] = [];

  for (const p of profiles) {
    if (p.phone === "0000000000") continue; // Skip existing miscellaneous profile

    // Determine the visit date (use db column, fall back to calculated latest order date)
    let visitDateStr = p.last_visit_at || latestVisitMap.get(p.phone);
    
    // If we have a visit date, but it's null in DB, queue it for backfilling
    if (visitDateStr && !p.last_visit_at) {
      backfillUpdates.push({ phone: p.phone, date: visitDateStr });
    }

    if (p.visit_count === 1 && visitDateStr) {
      const visitDate = new Date(visitDateStr);
      if (visitDate < oneYearAgo) {
        legacyCustomers.push({
          phone: p.phone,
          name: p.name,
          total_spent: p.total_spent,
          last_visit_at: visitDateStr
        });
      }
    }
  }

  console.log(`Found ${backfillUpdates.length} profiles requiring last_visit_at backfilling.`);
  console.log(`Found ${legacyCustomers.length} legacy single-visit customer profiles to group.`);

  // Perform backfilling in batches of 100 (for general DB consistency)
  if (backfillUpdates.length > 0) {
    console.log("Backfilling missing last_visit_at dates...");
    for (const update of backfillUpdates) {
      await supabase
        .from("customer_profiles")
        .update({ last_visit_at: update.date })
        .eq("phone", update.phone);
    }
    console.log("Backfilling complete.");
  }

  // Process legacy single-visit grouping
  if (legacyCustomers.length > 0) {
    console.log("Processing and re-linking orders to 'Miscellaneous'...");

    let successCount = 0;
    for (let i = 0; i < legacyCustomers.length; i++) {
      const customer = legacyCustomers[i];
      console.log(`[${i + 1}/${legacyCustomers.length}] Grouping ${customer.name || "Customer"} (${customer.phone}) - Spent: ₹${customer.total_spent}`);

      // Update orders table
      const { error: orderUpdateErr } = await supabase
        .from("orders")
        .update({ customer_phone: "0000000000", customer_name: "Miscellaneous" })
        .eq("customer_phone", customer.phone);

      if (orderUpdateErr) {
        console.error(`  └ ⚠️ Failed to update orders for ${customer.phone}:`, orderUpdateErr.message);
        continue;
      }

      // Update memberships table (just in case)
      await supabase
        .from("customer_memberships")
        .update({ customer_phone: "0000000000" })
        .eq("customer_phone", customer.phone);

      // Delete customer profile
      const { error: deleteErr } = await supabase
        .from("customer_profiles")
        .delete()
        .eq("phone", customer.phone);

      if (deleteErr) {
        console.error(`  └ ⚠️ Failed to delete profile for ${customer.phone}:`, deleteErr.message);
      } else {
        successCount++;
      }
    }

    console.log(`Successfully grouped and cleaned up ${successCount} legacy profiles.`);
  }

  // 4. Upsert / Refresh the single "Miscellaneous" customer profile stats
  console.log("Calculating aggregated statistics for 'Miscellaneous' profile...");
  const { data: miscOrders, error: miscOrdersErr } = await supabase
    .from("orders")
    .select("amount_due, advance_paid")
    .eq("customer_phone", "0000000000")
    .eq("status", "finalized");

  if (miscOrdersErr) {
    console.error("Error fetching miscellaneous orders:", miscOrdersErr.message);
    process.exit(1);
  }

  let totalSpent = 0;
  let visitCount = miscOrders?.length || 0;
  for (const o of miscOrders || []) {
    totalSpent += (Number(o.amount_due) || 0) + (Number(o.advance_paid) || 0);
  }

  console.log(`Aggregated stats for 'Miscellaneous' - Total Visits: ${visitCount}, Total Spent: ₹${totalSpent}`);

  const { error: upsertErr } = await supabase
    .from("customer_profiles")
    .upsert({
      phone: "0000000000",
      name: "Miscellaneous",
      visit_count: visitCount,
      total_spent: totalSpent,
      last_visit_at: new Date().toISOString()
    }, { onConflict: "phone" });

  if (upsertErr) {
    console.error("Failed to upsert 'Miscellaneous' customer profile:", upsertErr.message);
  } else {
    console.log("Successfully created/updated 'Miscellaneous' customer profile in database.");
  }
}

main().catch(console.error);
