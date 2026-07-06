import * as fs from "fs";

const envContent = fs.existsSync("/Users/ahmedbilal/Desktop/Gamehaus/.env.local") ? fs.readFileSync("/Users/ahmedbilal/Desktop/Gamehaus/.env.local", "utf-8") : "";
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (trimmed.startsWith("RAZORPAY") || trimmed.includes("RAZORPAY")) {
    const parts = trimmed.split("=");
    console.log("Raw line info:", parts[0], "value starts with:", parts[1] ? parts[1].substring(0, 5) : "none");
  }
}
