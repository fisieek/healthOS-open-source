"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileText, Image as ImageIcon } from "lucide-react";

export interface UploadResultMeta {
  intakeId: string;
  url: string;
  mimeType: string;
  size: number;
  fileName: string;
  /** in-memory dataUrl for preview, doesn't persist */
  preview: string;
}

export interface UploadDropzoneProps {
  onUploaded: (result: UploadResultMeta) => void;
  disabled?: boolean;
  hint?: string;
}

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export function UploadDropzone({ onUploaded, disabled, hint }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Nieobsługiwany typ pliku: ${file.type || "?"}`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`Plik za duży (max ${MAX_BYTES / 1024 / 1024} MB)`);
        return;
      }

      // Generate preview (image only)
      let preview = "";
      if (file.type.startsWith("image/")) {
        preview = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = (e) => resolve(e.target?.result as string);
          r.readAsDataURL(file);
        });
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/intake/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? `HTTP ${res.status}`);
          return;
        }
        onUploaded({
          intakeId: data.intakeId,
          url: data.url,
          mimeType: data.mimeType,
          size: data.size,
          fileName: file.name,
          preview,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onPick() {
    inputRef.current?.click();
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <div
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onPick();
        }}
        className={`flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:bg-accent/40"
        } ${disabled || uploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" />
            <p className="text-sm text-muted-foreground">Uploaduję plik…</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Kliknij lub upuść plik</p>
            <p className="text-xs text-muted-foreground mt-1">
              {hint ?? "JPG / PNG / WEBP / HEIC / PDF (max 15 MB)"}
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              Automatyczna klasyfikacja i ekstrakcja danych z pliku
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        onChange={onChange}
        disabled={disabled}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Small helper used by parent screens to render a tiny preview chip ──────

export function IntakeFilePreview({
  url,
  mimeType,
  fileName,
  onRemove,
}: {
  url: string | null;
  mimeType: string;
  fileName: string;
  onRemove?: () => void;
}) {
  const isImage = mimeType.startsWith("image/");
  return (
    <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/40 text-xs">
      {isImage && url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-10 w-10 object-cover rounded" />
      ) : (
        <div className="h-10 w-10 flex items-center justify-center rounded bg-background border border-border">
          {isImage ? (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          ) : (
            <FileText className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}
      <span className="flex-1 truncate font-mono">{fileName}</span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 shrink-0"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
