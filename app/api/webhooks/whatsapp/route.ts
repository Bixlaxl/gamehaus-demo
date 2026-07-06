import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "gamehaus_verify_token_2026";

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified successfully!");
      return new Response(challenge, { status: 200 });
    }

    console.warn("Webhook verification failed: invalid verify token or mode");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Log incoming webhook data for debugging
    console.log("WhatsApp Webhook payload:", JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    if (value && value.statuses && value.statuses.length > 0) {
      const supabase = createAdminClient() as any;
      
      for (const statusObj of value.statuses) {
        const messageId = statusObj.id;
        const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
        let errorMessage: string | null = null;
        
        if (statusObj.errors && statusObj.errors.length > 0) {
          errorMessage = statusObj.errors.map((e: any) => `${e.title} (code: ${e.code})`).join(", ");
        }

        console.log(`Webhook Update -> Message ID: ${messageId}, Status: ${status}`);

        // Update the log record in the database
        const { error } = await supabase
          .from("whatsapp_broadcast_logs")
          .update({
            status,
            error_message: errorMessage,
            updated_at: new Date().toISOString()
          })
          .eq("message_id", messageId);
          
        if (error) {
          console.error(`DB Update Error for message ${messageId}:`, error.message);
        }
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("Webhook POST handler exception:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
