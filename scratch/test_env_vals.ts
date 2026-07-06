import * as fs from "fs";

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

console.log("RAZORPAY_KEY_ID:", processEnv.RAZORPAY_KEY_ID ? `Length: ${processEnv.RAZORPAY_KEY_ID.length}` : "undefined/empty");
console.log("RAZORPAY_KEY_SECRET:", processEnv.RAZORPAY_KEY_SECRET ? `Length: ${processEnv.RAZORPAY_KEY_SECRET.length}` : "undefined/empty");
