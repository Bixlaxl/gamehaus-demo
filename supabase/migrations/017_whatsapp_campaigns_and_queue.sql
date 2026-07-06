-- Create whatsapp_campaigns table
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    template_name TEXT NOT NULL,
    image_url TEXT,
    button_url TEXT,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'sending', 'completed'
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create whatsapp_queue table
CREATE TABLE IF NOT EXISTS whatsapp_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID REFERENCES whatsapp_campaigns(id) ON DELETE CASCADE,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_queue ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_campaigns
DROP POLICY IF EXISTS "Allow service role full access to campaigns" ON whatsapp_campaigns;
CREATE POLICY "Allow service role full access to campaigns" ON whatsapp_campaigns
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to read campaigns" ON whatsapp_campaigns;
CREATE POLICY "Allow authenticated users to read campaigns" ON whatsapp_campaigns
    FOR SELECT TO authenticated USING (true);

-- Policies for whatsapp_queue
DROP POLICY IF EXISTS "Allow service role full access to queue" ON whatsapp_queue;
CREATE POLICY "Allow service role full access to queue" ON whatsapp_queue
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create the 'campaigns' storage bucket automatically
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaigns', 'campaigns', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public access to the 'campaigns' bucket
DROP POLICY IF EXISTS "Allow public read access to campaigns" ON storage.objects;
CREATE POLICY "Allow public read access to campaigns" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'campaigns');

DROP POLICY IF EXISTS "Allow authenticated uploads to campaigns" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to campaigns" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'campaigns');

