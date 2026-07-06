import { NextResponse } from "next/server";

export async function GET() {
  try {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !wabaId) {
      return NextResponse.json({ error: "Missing WhatsApp credentials in server environment." }, { status: 500 });
    }

    console.log("[Meta Templates] Fetching templates list from Graph API...");
    
    const response = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      },
      next: { revalidate: 10 } // Cache list for 10 seconds
    });

    const body = await response.json();
    if (!response.ok) {
      console.error("[Meta Templates] Error fetching templates:", body);
      return NextResponse.json({ error: body.error?.message || "Failed to fetch templates from Meta API." }, { status: response.status });
    }

    return NextResponse.json({ success: true, data: body.data || [] });
  } catch (err: any) {
    console.error("[Meta Templates] Exception:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
