import React, { useState } from "react";
import { uploadToSharePoint } from "@/utils/supabase/uploadToSharePoint";

export default function DocumentUploadCard() {
  const [file, setFile] = useState<File | null>(null);
  const [requestId, setRequestId] = useState("");
  const [department, setDepartment] = useState("");
  const [auditeeEmail, setAuditeeEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ webUrl: string; itemId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) return setError("Please choose a file.");
    if (!requestId || !department || !auditeeEmail) {
      return setError("Request ID, Department, and Auditee Email are required.");
    }

    try {
      setLoading(true);
      const data = await uploadToSharePoint({ file, requestId, department, auditeeEmail });
      setResult(data);
      // TODO: after success, upsert into your Supabase `documents` table if you aren't already doing this in the function.
      // e.g., save { request_id, file_name: file.name, sp_item_id: data.itemId, sp_web_url: data.webUrl, department, uploaded_by: auditeeEmail }
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Request ID</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={requestId}
          onChange={(e) => setRequestId(e.target.value)}
          placeholder="REQ-2025-0012"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Department</label>
        <input
          className="w-full rounded border px-3 py-2"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Finance"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Auditee Email</label>
        <input
          type="email"
          className="w-full rounded border px-3 py-2"
          value={auditeeEmail}
          onChange={(e) => setAuditeeEmail(e.target.value)}
          placeholder="jane.doe@yourco.com"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">File</label>
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg border px-4 py-2 font-medium hover:shadow"
      >
        {loading ? "Uploading..." : "Upload to SharePoint"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="rounded border p-3">
          <p className="text-sm">Uploaded ✔</p>
          <p className="text-sm break-all">
            <span className="font-medium">Link:</span>{" "}
            <a className="underline" href={result.webUrl} target="_blank" rel="noreferrer">
              {result.webUrl}
            </a>
          </p>
          <p className="text-xs text-gray-500">Item ID: {result.itemId}</p>
        </div>
      )}
    </form>
  );
}

