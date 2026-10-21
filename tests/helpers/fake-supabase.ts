/** In-memory stand-in for lib/supabase/admin.ts (no network, no real bucket). */
export const files = new Map<string, Buffer>();
export const signedUploads = new Map<string, string>();
export const bucketState = { public: false };

const BASE = "https://fake.supabase.local";
const BUCKET = "rfp-uploads";

function bucketApi() {
  return {
    async upload(path: string, body: Buffer | Uint8Array) {
      if (files.has(path)) return { data: null, error: new Error("exists") };
      files.set(path, Buffer.from(body));
      return { data: { path }, error: null };
    },
    async download(path: string) {
      const buf = files.get(path);
      if (!buf) return { data: null, error: new Error("Object not found") };
      return { data: new Blob([new Uint8Array(buf)]), error: null };
    },
    async createSignedUrl(path: string, expiresIn: number) {
      if (!files.has(path)) return { data: null, error: new Error("Object not found") };
      return { data: { signedUrl: `${BASE}/storage/v1/object/sign/${BUCKET}/${path}?token=t&expires=${expiresIn}` }, error: null };
    },
    async createSignedUploadUrl(path: string) {
      const token = `tok-${signedUploads.size + 1}`;
      signedUploads.set(token, path);
      return { data: { signedUrl: `${BASE}/storage/v1/object/upload/sign/${BUCKET}/${path}?token=${token}`, token, path }, error: null };
    },
    async list(folder: string, options?: { search?: string }) {
      const rows = [...files.entries()]
        .filter(([key]) => key.startsWith(`${folder}/`))
        .map(([key, buf]) => ({ name: key.slice(folder.length + 1), metadata: { size: buf.length } }))
        .filter((row) => !options?.search || row.name.includes(options.search));
      return { data: rows, error: null };
    },
    async remove(paths: string[]) {
      for (const p of paths) files.delete(p);
      return { data: [], error: null };
    },
    getPublicUrl(path: string) {
      return { data: { publicUrl: `${BASE}/storage/v1/object/public/${BUCKET}/${path}` } };
    },
  };
}

const client = {
  storage: {
    from: () => bucketApi(),
    async getBucket() {
      return { data: { public: bucketState.public }, error: null };
    },
  },
};

export function getSupabaseAdmin() {
  return client;
}
export function getRfpStorageBucket() {
  return BUCKET;
}
export function getRfpPublicUrl(path: string) {
  return bucketApi().getPublicUrl(path).data.publicUrl;
}
