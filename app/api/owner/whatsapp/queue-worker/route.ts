import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminAlert } from "@/lib/alerts/admin";

export const maxDuration = 60; // Allow Vercel/Railway up to 60 seconds

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { campaignId: reqCampaignId } = body;

    const admin = createAdminClient() as any;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !phoneNumberId || !wabaId) {
      return NextResponse.json({ error: "Missing WhatsApp credentials in server environment" }, { status: 500 });
    }

    // 1. Fetch the active campaign
    let campaignQuery = admin
      .from("whatsapp_campaigns")
      .select("*")
      .eq("status", "sending");

    if (reqCampaignId) {
      campaignQuery = campaignQuery.eq("id", reqCampaignId);
    }

    const { data: campaigns, error: campaignError } = await campaignQuery;

    if (campaignError) {
      console.error("[Queue Worker] Campaign fetch error:", campaignError.message);
      return NextResponse.json({ error: campaignError.message }, { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ success: true, message: "No active campaigns to process" });
    }

    // Select the oldest active campaign
    const campaign = campaigns[0];
    const campaignId = campaign.id;

    // 2. Fetch up to 30 pending queue items
    const { data: queueItems, error: queueError } = await admin
      .from("whatsapp_queue")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending")
      .limit(30);

    if (queueError) {
      console.error("[Queue Worker] Queue fetch error:", queueError.message);
      return NextResponse.json({ error: queueError.message }, { status: 500 });
    }

    // 3. If no pending items left, complete the campaign
    if (!queueItems || queueItems.length === 0) {
      // Mark campaign as completed
      const { error: completeError } = await admin
        .from("whatsapp_campaigns")
        .update({ status: "completed" })
        .eq("id", campaignId);

      if (completeError) {
        console.error("[Queue Worker] Failed to update campaign status:", completeError.message);
      }

      // Query final statistics
      const { data: finalStats } = await admin
        .from("whatsapp_campaigns")
        .select("name, total_recipients, sent_count, failed_count")
        .eq("id", campaignId)
        .single();

      if (finalStats) {
        await sendAdminAlert(
          `Campaign "${finalStats.name}" completed successfully! 
Total Recipients: ${finalStats.total_recipients}
Sent successfully: ${finalStats.sent_count}
Dropped / Failed: ${finalStats.failed_count}`,
          "success"
        );
      }

      // Check if there is another sending campaign to process
      const { data: remaining } = await admin
        .from("whatsapp_campaigns")
        .select("id")
        .eq("status", "sending")
        .limit(1);

      if (remaining && remaining.length > 0) {
        const origin = new URL(request.url).origin;
        fetch(`${origin}/api/owner/whatsapp/queue-worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId: remaining[0].id })
        }).catch((err) => console.error("[Queue Worker] Next trigger error:", err.message));
      }

      return NextResponse.json({ success: true, message: "Campaign complete. Queue finished." });
    }

    // Fetch template definition from Meta to inspect components dynamically
    console.log(`[Queue Worker] Fetching template definition for '${campaign.template_name}' from Meta...`);
    const tplRes = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates?name=${campaign.template_name}&limit=1`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    let hasImageHeader = false;
    let bodyVarsCount = 0;
    
    if (tplRes.ok) {
      const tplData = await tplRes.json();
      const metaTpl = tplData.data?.find((t: any) => t.name === campaign.template_name);
      if (metaTpl) {
        const headerComp = metaTpl.components?.find((c: any) => c.type === "HEADER");
        hasImageHeader = headerComp?.format === "IMAGE";
        
        const bodyComp = metaTpl.components?.find((c: any) => c.type === "BODY");
        if (bodyComp?.text) {
          bodyVarsCount = (bodyComp.text.match(/\{\{\d+\}\}/g) || []).length;
        }
        console.log(`[Queue Worker] Parsed '${campaign.template_name}'. ImageHeader: ${hasImageHeader}, BodyVars: ${bodyVarsCount}`);
      } else {
        console.warn(`[Queue Worker] Template '${campaign.template_name}' not found. Defaulting to standard parameters.`);
      }
    } else {
      console.warn(`[Queue Worker] Failed to fetch template metadata: ${tplRes.statusText}`);
    }

    console.log(`[Queue Worker] Processing batch of ${queueItems.length} messages for campaign '${campaign.name}'...`);

    // 4. Mark items as processing
    const ids = queueItems.map((item: any) => item.id);
    const { error: updateQueueError } = await admin
      .from("whatsapp_queue")
      .update({ status: "processing" })
      .in("id", ids);

    if (updateQueueError) {
      console.error("[Queue Worker] Failed to lock queue items:", updateQueueError.message);
      return NextResponse.json({ error: updateQueueError.message }, { status: 500 });
    }

    let batchSent = 0;
    let batchFailed = 0;

    // 5. Process each recipient sequentially in this batch
    for (const item of queueItems) {
      let cleanedPhone = item.recipient_phone.replace(/\D/g, "");
      if (cleanedPhone.length === 10) {
        cleanedPhone = "91" + cleanedPhone;
      }

      // Build components payload dynamically
      const components: any[] = [];

      // Add image header parameter ONLY if the template structure expects it
      if (hasImageHeader && campaign.image_url) {
        components.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: campaign.image_url
              }
            }
          ]
        });
      }

      // Add body variables parameters ONLY if the template has {{1}} placeholders
      if (bodyVarsCount > 0) {
        const bodyParams = Array.from({ length: bodyVarsCount }, (_, idx) => ({
          type: "text",
          text: idx === 0 ? (item.recipient_name || "Customer") : "Customer"
        }));
        
        components.push({
          type: "body",
          parameters: bodyParams
        });
      }

      const payload = {
        messaging_product: "whatsapp",
        to: cleanedPhone,
        type: "template",
        template: {
          name: campaign.template_name,
          language: {
            code: "en"
          },
          components
        }
      };

      try {
        const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        const resBody = await response.json();
        
        if (response.ok && resBody.messages && resBody.messages.length > 0) {
          const messageId = resBody.messages[0].id;
          
          // Update queue status
          await admin
            .from("whatsapp_queue")
            .update({ status: "sent" })
            .eq("id", item.id);

          // Write to tracking logs
          await admin
            .from("whatsapp_broadcast_logs")
            .upsert({
              message_id: messageId,
              recipient_phone: item.recipient_phone,
              recipient_name: item.recipient_name,
              status: "sent",
              updated_at: new Date().toISOString()
            }, { onConflict: "message_id" });

          batchSent++;
        } else {
          const errMsg = resBody.error?.message || "Unknown Meta API error";
          
          await admin
            .from("whatsapp_queue")
            .update({ status: "failed", error_message: errMsg })
            .eq("id", item.id);

          // Log failure
          await admin
            .from("whatsapp_broadcast_logs")
            .upsert({
              message_id: `fail-${item.id}`,
              recipient_phone: item.recipient_phone,
              recipient_name: item.recipient_name,
              status: "failed",
              error_message: errMsg,
              updated_at: new Date().toISOString()
            }, { onConflict: "message_id" });

          batchFailed++;
        }
      } catch (err: any) {
        console.error(`[Queue Worker] Send exception for ${item.recipient_phone}:`, err.message);
        
        await admin
          .from("whatsapp_queue")
          .update({ status: "failed", error_message: err.message })
          .eq("id", item.id);

        batchFailed++;
      }

      // Add a small 100ms throttle between Meta API requests to be gentle on rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // 6. Update campaign statistics
    try {
      const { error: rpcErr } = await admin.rpc("increment_campaign_stats", {
        p_campaign_id: campaignId,
        p_sent_inc: batchSent,
        p_failed_inc: batchFailed
      });
      if (rpcErr) throw rpcErr;
    } catch (err: any) {
      console.warn("[Queue Worker] RPC increment error, running fallback:", err.message || err);
      // Fallback if RPC is not compiled yet
      const { data: cur } = await admin
        .from("whatsapp_campaigns")
        .select("sent_count, failed_count")
        .eq("id", campaignId)
        .single();
      
      if (cur) {
        await admin
          .from("whatsapp_campaigns")
          .update({
            sent_count: cur.sent_count + batchSent,
            failed_count: cur.failed_count + batchFailed
          })
          .eq("id", campaignId);
      }
    }

    // 7. Trigger the next batch self-recursively
    const origin = new URL(request.url).origin;
    fetch(`${origin}/api/owner/whatsapp/queue-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId })
    }).catch((err) => {
      console.error("[Queue Worker] Next batch trigger failed:", err.message);
    });

    return NextResponse.json({
      success: true,
      processed: queueItems.length,
      sent: batchSent,
      failed: batchFailed
    });
  } catch (err: any) {
    console.error("[Queue Worker] Exception:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
