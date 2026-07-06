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
const razorpayKeyId = processEnv.RAZORPAY_KEY_ID;
const razorpayKeySecret = processEnv.RAZORPAY_KEY_SECRET;

async function main() {
  console.log("Check:", {
    supabaseUrl: !!supabaseUrl,
    supabaseKey: !!supabaseKey,
    razorpayKeyId: !!razorpayKeyId,
    razorpayKeySecret: !!razorpayKeySecret
  });
  if (!supabaseUrl || !supabaseKey || !razorpayKeyId || !razorpayKeySecret) {
    console.error("Missing credentials");
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  const orderId = "dca9020e-255d-45c0-98bc-88ff9fe2e169";
  const paymentId = "pay_TACSiGXGp0d149";
  const refundAmount = 380;

  console.log(`Triggering Razorpay refund of ₹${refundAmount} for payment ${paymentId}...`);
  const credentials = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
  const targetUrl = `https://api.razorpay.com/v1/payments/${paymentId}/refund`;

  const rpRes = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ amount: refundAmount * 100 }), // in paise
  });

  const rpText = await rpRes.text();
  console.log("Razorpay Response Status:", rpRes.status);
  console.log("Razorpay Response Body:", rpText);

  if (rpRes.ok) {
    console.log("Inserting negative payment row into database...");
    const { error: dbErr } = await supabase.from("payments").insert({
      order_id: orderId,
      amount: -refundAmount,
      method: "razorpay",
      status: "completed",
      collected_at: new Date().toISOString(),
    });

    if (dbErr) {
      console.error("DB error inserting negative payment:", dbErr);
    } else {
      console.log("Refund logged successfully in database!");
    }
  } else {
    console.error("Failed to process refund on Razorpay");
  }
}

main().catch(console.error);
