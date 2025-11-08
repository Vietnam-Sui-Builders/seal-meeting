export type WalrusUploadResult = {
  id?: string;
  url?: string;
  [key: string]: any;
};

export async function uploadToWalrus(blob: Blob, filename = 'recording.webm'): Promise<WalrusUploadResult> {
  const endpoint = process.env.NEXT_PUBLIC_WALRUS_ENDPOINT;
  if (!endpoint) {
    throw new Error('Missing NEXT_PUBLIC_WALRUS_ENDPOINT');
  }

  const form = new FormData();
  form.append('file', blob, filename);

  // Common pattern: multipart upload to /upload. Adjust if your Walrus API differs.
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/upload`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Walrus upload failed: ${res.status} ${text}`);
  }

  const json = (await res.json().catch(() => ({}))) as WalrusUploadResult;
  return json;
}