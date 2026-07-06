import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAdminAlert } from "@/lib/alerts/admin";

export async function POST(request: Request) {
  try {
    const { campaignName, templateName, imageUrl, buttonUrl, segment = "all", customPhones } = await request.json();

    if (!campaignName || !templateName) {
      return NextResponse.json({ error: "Missing required fields: campaignName or templateName" }, { status: 400 });
    }

    const admin = createAdminClient() as any;
    console.log(`[Campaigns] Initializing broadast campaign '${campaignName}' for segment '${segment}'...`);

    let validRecipients: { phone: string; name: string | null }[] = [];

    // 1. Resolve recipients based on target segment
    if (segment === "custom") {
      if (!customPhones || !customPhones.trim()) {
        return NextResponse.json({ error: "Please enter at least one custom phone number." }, { status: 400 });
      }
      
      const rawNumbers = customPhones.split(",").map((p: string) => p.trim());
      const phonePattern = /^[6-9]\d{9}$/;
      
      validRecipients = rawNumbers
        .filter((phone: string) => phonePattern.test(phone))
        .map((phone: string, index: number) => ({
          phone,
          name: `Selected Recipient ${index + 1}`
        }));
        
      if (validRecipients.length === 0) {
        return NextResponse.json({ error: "No valid 10-digit mobile numbers found in your input." }, { status: 400 });
      }
    } else if (segment === "gamehaus" || segment === "nerf-turf") {
      // Query customer phones with at least one order at the specified location slug
      const { data: orderCustomers, error: orderError } = await admin
        .from("orders")
        .select("customer_phone, customer_name, locations!inner(slug)")
        .eq("locations.slug", segment)
        .not("customer_phone", "is", null);

      if (orderError) {
        console.error(`[Campaigns] Failed to fetch customers for segment ${segment}:`, orderError.message);
        return NextResponse.json({ error: "Database query failed: " + orderError.message }, { status: 500 });
      }

      // De-duplicate by phone number to avoid sending duplicates to the same customer
      const phoneMap = new Map<string, string>();
      for (const ord of orderCustomers) {
        const cleaned = ord.customer_phone.replace(/\D/g, "");
        if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
          phoneMap.set(cleaned, ord.customer_name || "Customer");
        }
      }

      validRecipients = Array.from(phoneMap.entries()).map(([phone, name]) => ({
        phone,
        name
      }));
    } else {
      // Segment: "all"
      let profiles: { name: string | null; phone: string }[] = [];
      let offset = 0;
      const size = 1000;

      while (true) {
        const { data, error } = await admin
          .from("customer_profiles")
          .select("name, phone")
          .range(offset, offset + size - 1);

        if (error) {
          console.error("[Campaigns] Failed to fetch customer profiles:", error.message);
          return NextResponse.json({ error: "Database query failed: " + error.message }, { status: 500 });
        }

        if (!data || data.length === 0) break;
        profiles = profiles.concat(data);
        if (data.length < size) break;
        offset += size;
      }

      const phonePattern = /^[6-9]\d{9}$/;
      validRecipients = profiles
        .filter((p) => phonePattern.test(p.phone))
        .map((p) => ({
          phone: p.phone,
          name: p.name
        }));
    }

    if (validRecipients.length === 0) {
      return NextResponse.json({ error: `No recipients found matching segment filter: ${segment}` }, { status: 400 });
    }

    // 2. Create the campaign record
    const { data: campaign, error: campaignError } = await admin
      .from("whatsapp_campaigns")
      .insert({
        name: `${campaignName} [${segment.toUpperCase()}]`,
        template_name: templateName,
        image_url: imageUrl || null,
        button_url: buttonUrl || null,
        status: "sending",
        total_recipients: validRecipients.length,
        sent_count: 0,
        delivered_count: 0,
        read_count: 0,
        failed_count: 0
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      console.error("[Campaigns] Failed to create campaign:", campaignError?.message);
      return NextResponse.json({ error: "Failed to create campaign: " + campaignError?.message }, { status: 500 });
    }

    // 3. Populate the queue
    const queueItems = validRecipients.map((r) => ({
      campaign_id: campaign.id,
      recipient_phone: r.phone,
      recipient_name: r.name || "Customer",
      status: "pending"
    }));

    const chunkSize = 500;
    for (let i = 0; i < queueItems.length; i += chunkSize) {
      const chunk = queueItems.slice(i, i + chunkSize);
      const { error: queueError } = await admin
        .from("whatsapp_queue")
        .insert(chunk);

      if (queueError) {
        console.error("[Campaigns] Failed to populate queue:", queueError.message);
        await admin.from("whatsapp_campaigns").delete().eq("id", campaign.id);
        return NextResponse.json({ error: "Failed to populate queue: " + queueError.message }, { status: 500 });
      }
    }

    // 4. Send Admin Notification
    await sendAdminAlert(
      `Campaign "${campaign.name}" launched. Target segment: ${segment}. Total recipients: ${validRecipients.length}. Processing broadcast queue...`,
      "info"
    );

    // 5. Trigger the queue worker asynchronously
    const origin = new URL(request.url).origin;
    fetch(`${origin}/api/owner/whatsapp/queue-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId: campaign.id })
    }).catch((err) => {
      console.error("[Campaigns] Async worker trigger exception:", err.message);
    });

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      recipientsCount: validRecipients.length
    });
  } catch (err: any) {
    console.error("[Campaigns] Exception:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
