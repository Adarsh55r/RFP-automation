import { getRfpStorageBucket, getSupabaseAdmin } from "@/lib/supabase/admin";

/** Deletes every stored file for one RFP (the folder `<userId>/<rfpId>`). */
export async function removeRfpFiles(userId: string, rfpId: string) {
  const folder = `${userId}/${rfpId}`;
  const bucket = getSupabaseAdmin().storage.from(getRfpStorageBucket());
  const { data: listed, error } = await bucket.list(folder);
  if (error) throw error;
  if (listed?.length) {
    const { error: removeError } = await bucket.remove(listed.map((item) => `${folder}/${item.name}`));
    if (removeError) throw removeError;
  }
}
