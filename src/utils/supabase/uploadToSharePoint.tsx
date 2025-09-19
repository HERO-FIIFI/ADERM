import { createClient } from "@/utils/supabase/client";

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
  }
  return btoa(binary);
}

export async function uploadToSharePoint(params: {
  file: File;
  requestId: string;
  department: string;
  auditeeEmail: string;
}) {
  const { file, requestId, department, auditeeEmail } = params;
  const supabase = createClient();
  const fileContentBase64 = await fileToBase64(file);

  const { data, error } = await supabase.functions.invoke("upload-to-sharepoint", {
    body: { fileName: file.name, fileContentBase64, requestId, department, auditeeEmail },
    // headers: { "x-shared-secret": import.meta.env.VITE_FLOW_SECRET ?? "" } // only if you enforce extra check in function; usually not needed
  });

  if (error) throw error;
  return data as { itemId?: string; uniqueId?: string; serverRelativePath?: string; link?: string };
}
