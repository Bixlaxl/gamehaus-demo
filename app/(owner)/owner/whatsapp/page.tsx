import { createAdminClient } from "@/lib/supabase/admin";
import { WhatsappContent } from "./content";

export const runtime = 'edge';

const PAGE_SIZE = 100;

export default async function WhatsappPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    q?: string;
    status?: string;
  };
}) {
  const admin = createAdminClient();
  const page = Math.max(1, parseInt(searchParams.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  const q = searchParams.q?.trim() || "";
  const statusFilter = searchParams.status || "all";

  // Build the main query
  let query = admin
    .from("whatsapp_broadcast_logs")
    .select("*", { count: "exact" });

  if (q) {
    query = query.or(`recipient_phone.like.%${q}%,recipient_name.ilike.%${q}%`);
  }

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  // Sort by sent_at desc
  query = query.order("sent_at", { ascending: false }).range(from, to);

  // Fetch counts from the database to compute global stats
  const { data: logs, count: totalCount } = await query;
  const { data: statsData, error: statsError } = await (admin as any)
    .from("whatsapp_broadcast_logs")
    .select("status");

  if (statsError) {
    console.error("Error fetching stats data:", statsError.message);
  }

  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);

  // Fetch campaigns history
  const { data: campaigns } = await admin
    .from("whatsapp_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  // Compute aggregates
  const total = statsData?.length || 0;
  const sent = statsData?.filter((l: any) => l.status === "sent").length || 0;
  const delivered = statsData?.filter((l: any) => l.status === "delivered").length || 0;
  const read = statsData?.filter((l: any) => l.status === "read").length || 0;
  const failed = statsData?.filter((l: any) => l.status === "failed").length || 0;

  return (
    <WhatsappContent
      initialLogs={logs ?? []}
      initialCampaigns={campaigns ?? []}
      page={page}
      totalPages={totalPages}
      totalCount={totalCount ?? 0}
      stats={{
        total,
        sent,
        delivered,
        read,
        failed
      }}
      currentQ={q}
      currentStatus={statusFilter}
    />
  );
}
