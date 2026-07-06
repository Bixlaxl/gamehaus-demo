import { NextResponse } from "next/server";

// Helper to upload image to Meta's Resumable Upload API and return a file handle
async function getMetaFileHandle(imageUrl: string, appId: string, accessToken: string): Promise<string> {
  // 1. Download image bytes from Supabase
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download image from Supabase: ${imgRes.statusText}`);
  }
  
  const arrayBuffer = await imgRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const fileLength = buffer.length;
  
  const contentType = imgRes.headers.get("content-type") || "image/png";
  const ext = contentType.split("/")[1] || "png";
  const fileName = `sample_banner.${ext}`;

  console.log(`[Meta Upload] Initializing upload session for ${fileName} (${fileLength} bytes)...`);

  // 2. Start upload session on the App ID
  const initRes = await fetch(`https://graph.facebook.com/v20.0/${appId}/uploads?file_name=${fileName}&file_length=${fileLength}&file_type=${contentType}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`
    }
  });
  
  const initBody = await initRes.json();
  if (!initRes.ok) {
    throw new Error(`Meta Upload Init Error: ${initBody.error?.message || JSON.stringify(initBody)}`);
  }
  
  const uploadSessionId = initBody.id;
  console.log(`[Meta Upload] Session created: ${uploadSessionId}. Uploading bytes...`);

  // 3. Upload raw bytes to the session
  const uploadRes = await fetch(`https://graph.facebook.com/v20.0/${uploadSessionId}`, {
    method: "POST",
    headers: {
      "Authorization": `OAuth ${accessToken}`,
      "file_offset": "0",
      "Content-Type": "application/octet-stream"
    },
    body: buffer
  });

  const uploadBody = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`Meta Upload Byte Error: ${uploadBody.error?.message || JSON.stringify(uploadBody)}`);
  }

  if (!uploadBody.h) {
    throw new Error(`Meta upload response missing file handle: ${JSON.stringify(uploadBody)}`);
  }
  
  console.log(`[Meta Upload] File uploaded successfully. Handle: ${uploadBody.h}`);
  return uploadBody.h;
}

export async function POST(request: Request) {
  try {
    const { templateName, category, bodyText, imageUrl, buttonText, buttonUrl } = await request.json();

    // Validate inputs
    if (!templateName || !category || !bodyText) {
      return NextResponse.json({ error: "Missing required fields: templateName, category, or bodyText" }, { status: 400 });
    }

    if (imageUrl && (imageUrl.toLowerCase().includes(".webp") || imageUrl.includes("image/webp"))) {
      return NextResponse.json({ error: "Meta templates do not support WEBP images. Please upload a PNG or JPG/JPEG image instead." }, { status: 400 });
    }

    const cleanName = templateName.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!cleanName) {
      return NextResponse.json({ error: "Invalid template name. Must be alphanumeric and underscores only." }, { status: 400 });
    }

    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !wabaId) {
      return NextResponse.json({ 
        error: "Missing WhatsApp credentials in environment. Please define WHATSAPP_ACCESS_TOKEN and WHATSAPP_BUSINESS_ACCOUNT_ID in .env.local" 
      }, { status: 500 });
    }

    // Fetch App ID dynamically using debug_token
    console.log("[WhatsApp Templates] Fetching App ID dynamically...");
    const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`);
    const debugData = await debugRes.json();
    const appId = debugData.data?.app_id;

    if (!appId) {
      throw new Error(`Could not retrieve App ID from access token. Response: ${JSON.stringify(debugData)}`);
    }

    // Construct components for Meta Template API
    const components: any[] = [];

    // 1. Header (if image is provided, upload it to Meta first to get a file handle)
    if (imageUrl) {
      const fileHandle = await getMetaFileHandle(imageUrl, appId, accessToken);
      components.push({
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: [fileHandle]
        }
      });
    }

    // 2. Body Text (detect variables like {{1}} and automatically pass examples)
    const bodyComponent: any = {
      type: "BODY",
      text: bodyText
    };

    const varsCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;
    if (varsCount > 0) {
      const examples = Array.from({ length: varsCount }, (_, i) => i === 0 ? "CustomerName" : `SampleValue${i + 1}`);
      bodyComponent.example = {
        body_text: [ examples ]
      };
    }
    
    components.push(bodyComponent);

    // 3. CTA Buttons (if button text and link are provided)
    if (buttonText && buttonUrl) {
      components.push({
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: buttonText,
            url: buttonUrl
          }
        ]
      });
    }

    const payload = {
      name: cleanName,
      language: "en",
      category: category.toUpperCase(), // 'MARKETING' or 'UTILITY'
      components
    };

    console.log(`[WhatsApp Templates] Submitting template '${cleanName}' to Meta...`);

    const response = await fetch(`https://graph.facebook.com/v20.0/${wabaId}/message_templates`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("[WhatsApp Templates] Meta API Error:", responseText);
      return NextResponse.json({ error: responseText }, { status: response.status });
    }

    const responseData = JSON.parse(responseText);
    console.log(`[WhatsApp Templates] Successfully registered template:`, responseData);
    
    return NextResponse.json({ success: true, data: responseData });
  } catch (err: any) {
    console.error("[WhatsApp Templates] Exception:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
