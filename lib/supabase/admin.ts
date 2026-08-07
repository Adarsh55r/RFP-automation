import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return adminClient;
}

export function getRfpStorageBucket() {
  return process.env.SUPABASE_RFP_BUCKET ?? "rfp-uploads";
}

export function getRfpPublicUrl(storagePath: string) {
  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage
    .from(getRfpStorageBucket())
    .getPublicUrl(storagePath);

  return data.publicUrl;
}
