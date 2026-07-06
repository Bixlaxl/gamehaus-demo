"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  Search, MessageSquare, Check, CheckCheck, Eye, XCircle, ChevronLeft, ChevronRight, AlertTriangle 
} from "lucide-react";

export type WhatsappLog = {
  id: string;
  message_id: string;
  recipient_phone: string;
  recipient_name: string | null;
  status: string;
  error_message: string | null;
  sent_at: string;
  updated_at: string;
};

type WhatsappStats = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function WhatsappContent({
  initialLogs,
  initialCampaigns = [],
  page = 1,
  totalPages = 1,
  totalCount = 0,
  stats,
  currentQ = "",
  currentStatus = "all",
}: {
  initialLogs: WhatsappLog[];
  initialCampaigns?: any[];
  page?: number;
  totalPages?: number;
  totalCount?: number;
  stats: WhatsappStats;
  currentQ?: string;
  currentStatus?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<"logs" | "campaigns" | "create-template" | "new-campaign">("logs");
  const [search, setSearch] = useState(currentQ);
  const [status, setStatus] = useState(currentStatus);

  // Live Meta Templates State
  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const [metaTemplatesLoading, setMetaTemplatesLoading] = useState(false);
  const [metaTemplatesError, setMetaTemplatesError] = useState<string | null>(null);

  // Template Creator State
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("MARKETING");
  const [tplBodyText, setTplBodyText] = useState("");
  const [tplImageUrl, setTplImageUrl] = useState("");
  const [tplBtnText, setTplBtnText] = useState("");
  const [tplBtnUrl, setTplBtnUrl] = useState("");
  const [tplLoading, setTplLoading] = useState(false);
  const [tplSuccess, setTplSuccess] = useState<string | null>(null);
  const [tplError, setTplError] = useState<string | null>(null);
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // New Campaign State
  const [campName, setCampName] = useState("");
  const [campTplName, setCampTplName] = useState("");
  const [campImageUrl, setCampImageUrl] = useState("");
  const [campSegment, setCampSegment] = useState<"all" | "gamehaus" | "nerf-turf" | "custom">("all");
  const [campCustomPhones, setCampCustomPhones] = useState("");
  const [campLoading, setCampLoading] = useState(false);
  const [campSuccess, setCampSuccess] = useState<string | null>(null);
  const [campError, setCampError] = useState<string | null>(null);

  // Fetch Meta Templates List
  const fetchMetaTemplates = async () => {
    setMetaTemplatesLoading(true);
    setMetaTemplatesError(null);
    try {
      const res = await fetch("/api/owner/whatsapp/meta-templates");
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to load");
      setMetaTemplates(body.data || []);
    } catch (err: any) {
      setMetaTemplatesError(err.message);
    } finally {
      setMetaTemplatesLoading(false);
    }
  };

  // Sync state with url params
  useEffect(() => { setSearch(currentQ); }, [currentQ]);
  useEffect(() => { setStatus(currentStatus); }, [currentStatus]);

  // Fetch templates when entering the Create Template tab
  useEffect(() => {
    if (activeTab === "create-template") {
      fetchMetaTemplates();
    }
  }, [activeTab]);

  const updateFilters = (newParams: { page?: number; q?: string; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (newParams.page !== undefined) {
      params.set("page", newParams.page.toString());
    } else {
      params.set("page", "1");
    }

    if (newParams.q !== undefined) {
      if (newParams.q.trim()) {
        params.set("q", newParams.q.trim());
      } else {
        params.delete("q");
      }
    }

    if (newParams.status !== undefined) {
      if (newParams.status !== "all") {
        params.set("status", newParams.status);
      } else {
        params.delete("status");
      }
    }

    router.push(`/owner/whatsapp?${params.toString()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateFilters({ q: search });
    }
  };

  // Upload image banner to Supabase Storage
  const handleImageUpload = async (file: File, isTemplate: boolean) => {
    try {
      setUploading(true);
      const supabase = createClient();
      
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const { data, error } = await supabase.storage
        .from("campaigns")
        .upload(fileName, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("campaigns")
        .getPublicUrl(data.path);

      if (isTemplate) {
        setTplImageUrl(publicUrl);
      } else {
        setCampImageUrl(publicUrl);
      }
    } catch (err: any) {
      console.error("Storage upload failed:", err.message);
      alert(`Storage upload failed: ${err.message}. Please verify if "campaigns" public storage bucket is created in Supabase.`);
    } finally {
      setUploading(false);
    }
  };

  // Submit Template Creation Form
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTplLoading(true);
    setTplSuccess(null);
    setTplError(null);

    try {
      const response = await fetch("/api/owner/whatsapp/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: tplName,
          category: tplCategory,
          bodyText: tplBodyText,
          imageUrl: tplImageUrl || undefined,
          buttonText: tplBtnText || undefined,
          buttonUrl: tplBtnUrl || undefined,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Failed to create template");
      }

      setTplSuccess("Template registered successfully and submitted for Meta review!");
      setTplName("");
      setTplBodyText("");
      setTplImageUrl("");
      setTplBtnText("");
      setTplBtnUrl("");
      setTplFile(null);
      fetchMetaTemplates(); // Refresh templates list
    } catch (err: any) {
      setTplError(err.message);
    } finally {
      setTplLoading(false);
    }
  };

  // Submit Campaign Launch Form
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampLoading(true);
    setCampSuccess(null);
    setCampError(null);

    try {
      const response = await fetch("/api/owner/whatsapp/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignName: campName,
          templateName: campTplName,
          imageUrl: campImageUrl || undefined,
          segment: campSegment,
          customPhones: campSegment === "custom" ? campCustomPhones : undefined
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error || "Failed to launch campaign");
      }

      setCampSuccess(`Campaign launched successfully! Added ${body.recipientsCount} recipients to queue.`);
      setCampName("");
      setCampTplName("");
      setCampImageUrl("");
      setCampCustomPhones("");
      setCampSegment("all");
      router.refresh(); // Refresh page data
    } catch (err: any) {
      setCampError(err.message);
    } finally {
      setCampLoading(false);
    }
  };

  // Calculate percentages
  const deliveryRate = stats.total > 0 ? Math.round(((stats.delivered + stats.read) / stats.total) * 100) : 0;
  const readRate = (stats.delivered + stats.read) > 0 ? Math.round((stats.read / (stats.delivered + stats.read)) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">WhatsApp Campaign Manager</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create templates, submit them for Meta approval, launch bulk broadcasts, and track delivery status logs.
        </p>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-gray-200 dark:border-[#1A1A1A]">
        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "logs"
              ? "border-[#D4541A] text-[#D4541A] dark:text-[#E8642A]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          Recipient Logs
        </button>
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "campaigns"
              ? "border-[#D4541A] text-[#D4541A] dark:text-[#E8642A]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          Campaign History
        </button>
        <button
          onClick={() => setActiveTab("create-template")}
          className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "create-template"
              ? "border-[#D4541A] text-[#D4541A] dark:text-[#E8642A]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          Create Template
        </button>
        <button
          onClick={() => setActiveTab("new-campaign")}
          className={`pb-4 px-4 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "new-campaign"
              ? "border-[#D4541A] text-[#D4541A] dark:text-[#E8642A]"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          }`}
        >
          New Campaign
        </button>
      </div>

      {/* Tab content: Logs */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-5 shadow-sm flex items-start justify-between hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#666] uppercase tracking-wider">Total Dispatched</span>
                <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">{stats.total}</div>
                <p className="text-[10px] text-gray-400 dark:text-[#555]">Messages accepted by Meta Cloud</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
                <MessageSquare className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-5 shadow-sm flex items-start justify-between hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#666] uppercase tracking-wider">Delivered</span>
                <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {stats.delivered + stats.read}
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 ml-2">({deliveryRate}%)</span>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-[#555]">Successfully reached recipient phone</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <CheckCheck className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-5 shadow-sm flex items-start justify-between hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#666] uppercase tracking-wider">Read / Opened</span>
                <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {stats.read}
                  <span className="text-sm font-medium text-violet-600 dark:text-violet-400 ml-2">({readRate}%)</span>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-[#555]">Recipient opened and read the message</p>
              </div>
              <div className="p-3 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 rounded-lg">
                <Eye className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-5 shadow-sm flex items-start justify-between hover:shadow-md transition-all">
              <div className="space-y-2">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#666] uppercase tracking-wider">Failed / Dropped</span>
                <div className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  {stats.failed}
                  {stats.total > 0 && (
                    <span className="text-sm font-medium text-red-600 dark:text-red-400 ml-2">
                      ({Math.round((stats.failed / stats.total) * 100)}%)
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 dark:text-[#555]">Silent drop / invalid number / blocked</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg">
                <XCircle className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* Filters & Actions Bar */}
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-[#444]" />
              <Input
                placeholder="Search by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => updateFilters({ q: search })}
                className="pl-9 h-10 bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222] text-sm text-gray-900 dark:text-white rounded-lg focus:ring-[#D4541A] focus:border-[#D4541A]"
              />
            </div>

            <div className="flex gap-3 w-full md:w-auto items-center justify-end">
              <span className="text-xs font-semibold text-gray-500 dark:text-[#666] hidden md:inline">Filter by Status:</span>
              <Select
                value={status}
                onValueChange={(val) => {
                  setStatus(val);
                  updateFilters({ status: val });
                }}
              >
                <SelectTrigger className="w-full md:w-44 h-10 bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222] text-sm rounded-lg">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-[#1A1A1A]">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Sent / Outbox</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="read">Read / Opened</SelectItem>
                  <SelectItem value="failed">Failed / Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-[#1A1A1A]">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Recipient</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Details / Errors</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Sent Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-[#151515]">
                  {initialLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                        No broadcast logs matching your query were found.
                      </td>
                    </tr>
                  ) : (
                    initialLogs.map((log) => {
                      let statusColor = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
                      let statusLabel = "Sent";
                      let statusIcon = <Check className="h-3 w-3 mr-1" />;

                      if (log.status === "delivered") {
                        statusColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400";
                        statusLabel = "Delivered";
                        statusIcon = <CheckCheck className="h-3 w-3 mr-1" />;
                      } else if (log.status === "read") {
                        statusColor = "bg-violet-100 text-violet-800 dark:bg-violet-950/20 dark:text-violet-400";
                        statusLabel = "Read";
                        statusIcon = <Eye className="h-3 w-3 mr-1" />;
                      } else if (log.status === "failed") {
                        statusColor = "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400";
                        statusLabel = "Failed";
                        statusIcon = <XCircle className="h-3 w-3 mr-1" />;
                      }

                      return (
                        <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-[#111]/30 transition-all">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                            {log.recipient_name || "Walk-in Customer"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {log.recipient_phone}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <Badge className={`${statusColor} font-semibold flex items-center w-max px-2 py-0.5 rounded-full border-none shadow-none`}>
                              {statusIcon}
                              {statusLabel}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {log.status === "failed" && log.error_message ? (
                              <span className="text-red-600 dark:text-red-400 flex items-center gap-1.5 font-medium">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                {log.error_message}
                              </span>
                            ) : log.status === "sent" ? (
                              <span className="text-xs text-gray-400 dark:text-gray-600 italic">Meta queue pending</span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-[#333] font-mono select-all">wamid: {log.message_id.slice(-10)}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                            {fmtDate(log.sent_at)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#1A1A1A] flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-[#666]">
                  Showing page <strong className="font-semibold text-gray-900 dark:text-white">{page}</strong> of <strong className="font-semibold text-gray-900 dark:text-white">{totalPages}</strong> ({totalCount} total logs)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => updateFilters({ page: page - 1 })}
                    className="h-8 px-3 rounded-lg border-gray-200 dark:border-[#222] text-xs"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => updateFilters({ page: page + 1 })}
                    className="h-8 px-3 rounded-lg border-gray-200 dark:border-[#222] text-xs"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content: Campaigns History */}
      {activeTab === "campaigns" && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#111] border-b border-gray-200 dark:border-[#1A1A1A]">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Campaign Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Template Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Delivery Stats</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-[#666] uppercase tracking-wider">Date Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 dark:divide-[#151515]">
                {initialCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                      No broadcast campaigns have been launched yet.
                    </td>
                  </tr>
                ) : (
                  initialCampaigns.map((camp: any) => {
                    const progress = camp.total_recipients > 0 ? Math.round(((camp.sent_count + camp.failed_count) / camp.total_recipients) * 100) : 0;
                    
                    return (
                      <tr key={camp.id} className="hover:bg-gray-50/50 dark:hover:bg-[#111]/30 transition-all">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                          {camp.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {camp.template_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {camp.status === "sending" ? (
                            <div className="flex flex-col gap-1.5 w-36">
                              <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                                <span className="animate-ping h-1.5 w-1.5 rounded-full bg-orange-600 dark:bg-orange-400"></span>
                                Sending ({progress}%)
                              </span>
                              <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                <div className="bg-orange-500 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                              </div>
                            </div>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full border-none shadow-none">
                              Completed
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400 font-medium">
                          <div className="flex gap-4">
                            <span>Total: <strong>{camp.total_recipients}</strong></span>
                            <span className="text-blue-600 dark:text-blue-400">Sent: <strong>{camp.sent_count}</strong></span>
                            <span className="text-emerald-600 dark:text-emerald-400">Delivered: <strong>{camp.delivered_count}</strong></span>
                            <span className="text-violet-600 dark:text-violet-400 font-semibold">Read: <strong>{camp.read_count}</strong></span>
                            {camp.failed_count > 0 && <span className="text-red-500">Failed: <strong>{camp.failed_count}</strong></span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {fmtDate(camp.created_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab content: Create Template */}
      {activeTab === "create-template" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-6 shadow-sm">
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Submit New Template to Meta</h2>
              
              {tplSuccess && <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg font-semibold">{tplSuccess}</div>}
              {tplError && <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-lg font-medium">{tplError}</div>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-[#666] uppercase">Template Name</label>
                  <Input
                    placeholder="e.g. gamehaus_open_till_3"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                    required
                    className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]"
                  />
                  <p className="text-[10px] text-gray-400">Lowercase alphanumeric and underscores only</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 dark:text-[#666] uppercase">Category</label>
                  <Select value={tplCategory} onValueChange={setTplCategory}>
                    <SelectTrigger className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-[#1A1A1A]">
                      <SelectItem value="MARKETING">Marketing (Promotional)</SelectItem>
                      <SelectItem value="UTILITY">Utility (Transactional)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-[#666] uppercase">Body Text</label>
                <textarea
                  placeholder="Write your template message body here. Use {{1}} to insert dynamic customer name."
                  value={tplBodyText}
                  onChange={(e) => setTplBodyText(e.target.value)}
                  required
                  rows={5}
                  className="w-full p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#222] text-sm text-gray-900 dark:text-white rounded-lg focus:ring-[#D4541A] focus:border-[#D4541A]"
                />
              </div>

              <div className="border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Image Banner Header (Optional)</h3>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400">Upload Banner Image File</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], true)}
                    className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 dark:file:bg-orange-950/20 dark:file:text-orange-400 hover:file:bg-orange-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-400">Or Paste Image URL directly</label>
                  <Input
                    placeholder="https://example.com/banner.png"
                    value={tplImageUrl}
                    onChange={(e) => setTplImageUrl(e.target.value)}
                    className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]"
                  />
                </div>
                {uploading && <p className="text-xs text-orange-600 animate-pulse font-medium">Uploading file to storage...</p>}
              </div>

              <div className="border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-4 space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">CTA Button Link (Optional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">Button Label</label>
                    <Input
                      placeholder="e.g. 📍 Navigate to Turf"
                      value={tplBtnText}
                      onChange={(e) => setTplBtnText(e.target.value)}
                      className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-400">Button Destination URL</label>
                    <Input
                      placeholder="https://maps.google.com/..."
                      value={tplBtnUrl}
                      onChange={(e) => setTplBtnUrl(e.target.value)}
                      className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]"
                    />
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                disabled={tplLoading || uploading}
                className="w-full bg-[#D4541A] hover:bg-[#B44410] dark:bg-[#E8642A] dark:hover:bg-[#C8541C] text-white font-bold h-11 rounded-lg transition-all"
              >
                {tplLoading ? "Submitting..." : "Submit Template to Meta"}
              </Button>
            </form>
          </div>

          {/* Right Column: Live Templates list */}
          <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-150 dark:border-[#151515] pb-3">
              <h3 className="font-bold text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Live Meta Templates</h3>
              <Button 
                onClick={fetchMetaTemplates} 
                variant="outline" 
                size="sm"
                disabled={metaTemplatesLoading}
                className="h-8 px-2 rounded-lg border-gray-200 dark:border-[#222] text-xs font-bold"
              >
                {metaTemplatesLoading ? "Refreshing..." : "Refresh Status"}
              </Button>
            </div>

            {metaTemplatesError && (
              <p className="text-xs text-red-500 font-semibold">{metaTemplatesError}</p>
            )}

            {metaTemplatesLoading ? (
              <div className="py-8 text-center text-xs text-gray-400 dark:text-[#666] animate-pulse">Fetching from Meta...</div>
            ) : metaTemplates.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 dark:text-[#666]">No templates registered in Meta yet.</div>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {metaTemplates.map((tpl: any) => {
                  let statusColor = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
                  if (tpl.status === "APPROVED") {
                    statusColor = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400";
                  } else if (tpl.status === "PENDING" || tpl.status === "IN_REVIEW") {
                    statusColor = "bg-orange-100 text-orange-800 dark:bg-orange-950/20 dark:text-orange-400";
                  } else if (tpl.status === "REJECTED") {
                    statusColor = "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400";
                  }

                  const bodyComp = tpl.components?.find((c: any) => c.type === "BODY");
                  const bodySnippet = bodyComp?.text ? (bodyComp.text.slice(0, 80) + (bodyComp.text.length > 80 ? "..." : "")) : "";

                  return (
                    <div key={tpl.id} className="border border-gray-150 dark:border-[#151515] p-3 rounded-xl hover:bg-gray-50/50 dark:hover:bg-[#111]/30 transition-all flex flex-col gap-2">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-gray-900 dark:text-white font-mono break-all pr-2">{tpl.name}</span>
                        <Badge className={`${statusColor} text-[10px] font-bold px-2 py-0.5 rounded-full border-none shadow-none`}>
                          {tpl.status}
                        </Badge>
                      </div>
                      {bodySnippet && <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-normal">{bodySnippet}</p>}
                      <div className="flex gap-2.5 text-[9px] text-gray-400 font-semibold uppercase">
                        <span>{tpl.category}</span>
                        <span>•</span>
                        <span>{tpl.language}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab content: New Campaign */}
      {activeTab === "new-campaign" && (
        <div className="bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-6 shadow-sm max-w-2xl">
          <form onSubmit={handleLaunchCampaign} className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Launch Bulk Broadcast Campaign</h2>
            
            {campSuccess && <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg font-semibold">{campSuccess}</div>}
            {campError && <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-lg font-medium">{campError}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-[#666] uppercase">Campaign Name</label>
                <Input
                  placeholder="e.g. Late Night Open 3AM Broadcast"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  required
                  className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 dark:text-[#666] uppercase">Approved Meta Template Name</label>
                <Input
                  placeholder="e.g. gamehaus_open_till_3"
                  value={campTplName}
                  onChange={(e) => setCampTplName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
                  required
                  className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 dark:text-[#666] uppercase">Target Customer Segment</label>
              <Select 
                value={campSegment} 
                onValueChange={(val: any) => setCampSegment(val)}
              >
                <SelectTrigger className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222] h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#0A0A0A] border-gray-200 dark:border-[#1A1A1A]">
                  <SelectItem value="all">All Customers (Complete Database)</SelectItem>
                  <SelectItem value="gamehaus">Gamehaus Customers Only (Based on Booking History)</SelectItem>
                  <SelectItem value="nerf-turf">Nerf Turf Customers Only (Based on Booking History)</SelectItem>
                  <SelectItem value="custom">Selected Numbers / Custom Test Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {campSegment === "custom" && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-bold text-gray-500 dark:text-[#666] uppercase">Custom Phone Numbers</label>
                <textarea
                  placeholder="Enter 10-digit mobile numbers separated by commas. E.g. 9994166622,9841046786"
                  value={campCustomPhones}
                  onChange={(e) => setCampCustomPhones(e.target.value.replace(/[^0-9,]/g, ""))}
                  required
                  rows={3}
                  className="w-full p-3 bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#222] text-sm text-gray-900 dark:text-white rounded-lg focus:ring-[#D4541A] focus:border-[#D4541A]"
                />
                <p className="text-[10px] text-gray-400">Only valid 10-digit numbers starting with 6-9 will be added to queue.</p>
              </div>
            )}

            <div className="border border-gray-200 dark:border-[#1A1A1A] rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Banner Header Image URL (Optional)</h3>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">Upload Banner Image File</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], false)}
                  className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 dark:file:bg-orange-950/20 dark:file:text-orange-400 hover:file:bg-orange-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400">Or Paste Image URL directly</label>
                <Input
                  placeholder="https://example.com/banner.png"
                  value={campImageUrl}
                  onChange={(e) => setCampImageUrl(e.target.value)}
                  className="bg-gray-50 dark:bg-[#111] border-gray-200 dark:border-[#222]"
                />
              </div>
              {uploading && <p className="text-xs text-orange-600 animate-pulse font-medium">Uploading file to storage...</p>}
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-950/10 border border-orange-200 dark:border-orange-900/30 rounded-xl">
              <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                ⚠️ <strong>Important Reminder:</strong> This broadcast will fetch all valid customer phone numbers from the chosen segment and send them the selected template. Ensure the template is fully approved by Meta before launching.
              </p>
            </div>

            <Button
              type="submit"
              disabled={campLoading || uploading}
              className="w-full bg-[#D4541A] hover:bg-[#B44410] dark:bg-[#E8642A] dark:hover:bg-[#C8541C] text-white font-bold h-11 rounded-lg transition-all"
            >
              {campLoading ? "Launching Broadcast..." : "Launch Bulk Broadcast"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
