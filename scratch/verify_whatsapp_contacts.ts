import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// 1. Load environment variables manually from .env.local
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

const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || processEnv.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || processEnv.WHATSAPP_PHONE_NUMBER_ID;

async function main() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
  }
  if (!accessToken || !phoneNumberId) {
    console.error("Missing WhatsApp credentials (access token or phone number ID) in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Fetching customer profiles from Supabase...");

  // Fetch all profiles
  let profiles: { name: string | null; phone: string }[] = [];
  let offset = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("name, phone")
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

  // Validate phone format (10-digit Indian numbers starting with 6-9)
  const phonePattern = /^[6-9]\d{9}$/;
  const validProfiles = profiles.filter((p) => phonePattern.test(p.phone));

  console.log(`\nTotal customer profiles in DB: ${profiles.length}`);
  console.log(`Valid 10-digit numbers to check: ${validProfiles.length}\n`);

  if (validProfiles.length === 0) {
    console.log("No valid phone numbers to check.");
    process.exit(0);
  }

  const batchSize = 100; // Meta allows up to 100 numbers per request
  const invalidNumbers: { phone: string; name: string | null }[] = [];
  const validNumbers: string[] = [];

  console.log("Starting contact verification with Meta Cloud API...");

  for (let i = 0; i < validProfiles.length; i += batchSize) {
    const batch = validProfiles.slice(i, i + batchSize);
    // Format contacts with country code prepended (+91...)
    const contactsPayload = batch.map((p) => `+91${p.phone}`);

    console.log(`Checking batch [${Math.floor(i / batchSize) + 1}/${Math.ceil(validProfiles.length / batchSize)}] (Size: ${batch.length})...`);

    try {
      const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/contacts`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blocking: "wait",
          contacts: contactsPayload,
          force_check: true
        })
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error?.message || `HTTP ${res.status}`);
      }

      const verifiedContacts = body.contacts || [];
      for (const checked of verifiedContacts) {
        // Remove country code to match db entry
        const plainPhone = checked.input.replace("+91", "");
        const originalProfile = batch.find((p) => p.phone === plainPhone);

        if (checked.status === "invalid") {
          console.log(`  └ ❌ Invalid WhatsApp user: ${plainPhone} (${originalProfile?.name || "Unknown"})`);
          invalidNumbers.push({ phone: plainPhone, name: originalProfile?.name || null });
        } else if (checked.status === "valid") {
          validNumbers.push(plainPhone);
        }
      }
    } catch (err: any) {
      console.error(`  └ ⚠️ Error checking batch:`, err.message);
    }

    // Small delay to respect rate limit
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  console.log("\n==================================================");
  console.log("Verification Completed!");
  console.log(`Total Checked: ${validProfiles.length}`);
  console.log(`Valid WhatsApp Users: ${validNumbers.length}`);
  console.log(`Invalid WhatsApp Users: ${invalidNumbers.length}`);
  console.log("==================================================");

  // Write invalid report to file
  if (invalidNumbers.length > 0) {
    fs.writeFileSync("scratch/invalid_whatsapp_numbers.json", JSON.stringify(invalidNumbers, null, 2));
    console.log("Report saved to 'scratch/invalid_whatsapp_numbers.json'");
  } else {
    console.log("Success! All checked numbers are registered on WhatsApp.");
  }
}

main().catch(console.error);
