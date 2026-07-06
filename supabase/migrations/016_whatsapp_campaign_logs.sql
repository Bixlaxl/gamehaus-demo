-- Create WhatsApp broadcast logs table
CREATE TABLE IF NOT EXISTS whatsapp_broadcast_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id TEXT UNIQUE NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    status TEXT NOT NULL, -- 'sent', 'delivered', 'read', 'failed'
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE whatsapp_broadcast_logs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role / admin client full access
CREATE POLICY "Allow service role full access" ON whatsapp_broadcast_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create policy to allow authenticated dashboard users to read
CREATE POLICY "Allow authenticated users to read logs" ON whatsapp_broadcast_logs
    FOR SELECT TO authenticated USING (true);
