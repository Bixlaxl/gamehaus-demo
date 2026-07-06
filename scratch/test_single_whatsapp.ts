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

const supabaseUrl = processEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = processEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const WHATSAPP_ACCESS_TOKEN = "EAGC8jgrZCtwgBR685IGivPbH0zovCsvZAyWSxXIWtNh3ffLHIS4MFR7WAeMI1NAcLZBH1qkQO5sCOtRvoING8d8VgRrZB3gT97gaKtjOsVg9dpiADk1rNZAyg1FjlN2p4OLOT3SEGZA2a4e8WKWCbThrFqAQutpnk3qchZCO0EZA7ObqpZADMhXpjHTd7VOZAk9gZDZD";
const WHATSAPP_PHONE_NUMBER_ID = "1217928801397537";
const TEMPLATE_NAME = "gamehaus_open_till_3";
const MEDIA_ID = "907036948319389";

async function main() {
  const phoneInput = process.argv[2];
  const nameInput = process.argv[3] || "Test Customer";

  if (!phoneInput) {
    console.log("Usage: npx tsx scratch/test_single_whatsapp.ts <10-digit-phone> [name]");
    console.log("Example: npx tsx scratch/test_single_whatsapp.ts 9994166622 \"Sahil\"");
    process.exit(1);
  }

  const phonePattern = /^[6-9]\d{9}$/;
  if (!phonePattern.test(phoneInput)) {
    console.error("Error: Please provide a valid 10-digit Indian phone number (starting with 6-9).");
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing Supabase credentials in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const formattedPhone = `91${phoneInput}`;

  console.log(`Sending diagnostic message to ${nameInput} (${phoneInput})...`);

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
      console.log(`\n✅ API Success! Meta Message ID: ${messageId}`);
      console.log("Logging to database...");

      const { error: dbError } = await supabase
        .from("whatsapp_broadcast_logs")
        .upsert({
          message_id: messageId,
          recipient_phone: phoneInput,
          recipient_name: nameInput,
          status: "sent",
          updated_at: new Date().toISOString()
        }, { onConflict: "message_id" });

      if (dbError) {
        console.error(`❌ DB Logging Error: ${dbError.message}`);
      } else {
        console.log("✅ Logged in database as 'sent'.");
        console.log("\nIf your webhook is online, check your Owner Dashboard at `/owner/whatsapp` to see if it updates to 'delivered', 'read', or shows a 'failed' reason.");
      }
    } else {
      const errMsg = body.error?.message || "Unknown error";
      console.error(`\n❌ Meta API Error: ${errMsg}`);
    }
  } catch (e: any) {
    console.error(`\n❌ Network/Fetch Error: ${e?.message}`);
  }
}

main();
