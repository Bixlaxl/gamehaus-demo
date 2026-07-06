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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || processEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || processEnv.SUPABASE_SERVICE_ROLE_KEY;

const WHATSAPP_ACCESS_TOKEN = "EAGC8jgrZCtwgBR685IGivPbH0zovCsvZAyWSxXIWtNh3ffLHIS4MFR7WAeMI1NAcLZBH1qkQO5sCOtRvoING8d8VgRrZB3gT97gaKtjOsVg9dpiADk1rNZAyg1FjlN2p4OLOT3SEGZA2a4e8WKWCbThrFqAQutpnk3qchZCO0EZA7ObqpZADMhXpjHTd7VOZAk9gZDZD";
const WHATSAPP_PHONE_NUMBER_ID = "1217928801397537";
const TEMPLATE_NAME = "gamehaus_open_till_3";
const MEDIA_ID = "907036948319389";

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in env.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Fetching customer profiles from Supabase...");
  let profiles: { name: string | null; phone: string }[] = [];
  let offset = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("name, phone")
      .range(offset, offset + size - 1);
    if (error) {
      console.error("Error fetching profiles:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    profiles = profiles.concat(data);
    if (data.length < size) break;
    offset += size;
  }

  const phonePattern = /^[6-9]\d{9}$/;
  const validCustomers = profiles.filter((p) => phonePattern.test(p.phone));

  console.log(`Found ${validCustomers.length} valid 10-digit customer phone numbers.`);

  // Slice to only include customers from index 1000 onwards (the remaining 733)
  const startIndex = 1000;
  const remainingCustomers = validCustomers.slice(startIndex);

  console.log(`Skipping first ${startIndex} customers.`);
  console.log(`Starting broadcast for the remaining ${remainingCustomers.length} customers (from index ${startIndex + 1} to ${validCustomers.length})...`);
  
  if (remainingCustomers.length === 0) {
    console.log("No remaining customers to send to. Exiting.");
    process.exit(0);
  }

  console.log("Starting in 5 seconds... Press Ctrl+C to abort.");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const results = {
    success: [] as string[],
    failed: [] as { phone: string; name: string | null; error: string }[],
  };

  const delayMs = 60; // Safe rate limit

  for (let i = 0; i < remainingCustomers.length; i++) {
    const customer = remainingCustomers[i];
    const globalIndex = startIndex + i + 1;
    const formattedPhone = `91${customer.phone}`;

    console.log(`[${globalIndex}/${validCustomers.length}] Sending to ${customer.name || "Customer"} (${customer.phone})...`);

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: {
              code: "en",
            },
            components: [
              {
                type: "header",
                parameters: [
                  {
                    type: "image",
                    image: {
                      id: MEDIA_ID,
                    },
                  },
                ],
              },
            ],
          },
        }),
      });

      const body = await res.json();
      if (res.ok && body.messages) {
        const messageId = body.messages[0].id;
        results.success.push(customer.phone);
        console.log(`  └ ✅ Success: ${messageId}`);

        // Log to Supabase
        const { error: dbError } = await supabase
          .from("whatsapp_broadcast_logs")
          .upsert({
            message_id: messageId,
            recipient_phone: formattedPhone,
            recipient_name: customer.name || null,
            status: "sent",
            updated_at: new Date().toISOString()
          }, { onConflict: "message_id" });
        if (dbError) {
          console.error(`  └ ⚠️ DB Logging Error: ${dbError.message}`);
        }
      } else {
        const errMsg = body.error?.message || "Unknown error";
        results.failed.push({ phone: customer.phone, name: customer.name, error: errMsg });
        console.error(`  └ ❌ Failed: ${errMsg}`);
      }
    } catch (e: any) {
      results.failed.push({ phone: customer.phone, name: customer.name, error: e?.message || "Fetch error" });
      console.error(`  └ ❌ Fetch Exception: ${e?.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  console.log("\n==================================================");
  console.log("Broadcast Completed!");
  console.log(`Successfully sent today: ${results.success.length}`);
  console.log(`Failed today: ${results.failed.length}`);
  console.log("==================================================");

  if (results.failed.length > 0) {
    fs.writeFileSync("failed_whatsapp_sends_remaining.json", JSON.stringify(results.failed, null, 2));
    console.log("Failed list saved to 'failed_whatsapp_sends_remaining.json'");
  }
}

main();
