/**
 * Admin Alerts Utility
 * Sends notifications to the developer/admin when WhatsApp campaigns start and complete.
 */

const DISCORD_WEBHOOK_URL = process.env.ADMIN_ALERTS_DISCORD_WEBHOOK_URL;

export async function sendAdminAlert(message: string, type: "info" | "success" | "warning" = "info") {
  const timestamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const formattedMessage = `[${timestamp}] [WhatsApp Campaign - ${type.toUpperCase()}] ${message}`;

  // Log to server console
  console.log(formattedMessage);

  // If a Discord webhook is configured, send the alert there
  if (DISCORD_WEBHOOK_URL) {
    try {
      const colorMap = {
        info: 3447003,    // Blue
        success: 3066993, // Green
        warning: 15158332 // Orange/Red
      };

      await fetch(DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: `WhatsApp Campaign Notification`,
              description: message,
              color: colorMap[type],
              timestamp: new Date().toISOString(),
            }
          ]
        })
      });
    } catch (err: any) {
      console.error("Failed to send admin alert to Discord webhook:", err.message);
    }
  }
}
