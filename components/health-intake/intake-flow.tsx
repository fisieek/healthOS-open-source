"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { UploadDropzone, IntakeFilePreview, type UploadResultMeta } from "./upload-dropzone";
import { BodyCompositionReviewForm } from "./body-composition-review";
import { BloodTestReviewForm } from "./blood-test-review";

type Phase =
  | { kind: "idle" }
  | { kind: "uploaded"; meta: UploadResultMeta }
  | { kind: "classifying"; meta: UploadResultMeta }
  | { kind: "classified"; meta: UploadResultMeta; result: ClassifyResponse }
  | { kind: "saved"; meta: UploadResultMeta; targetUrl?: string; targetId?: string };

interface ClassifyResponse {
  intakeId: string;
  status: string;
  kind: string | null;
  classification:
    | {
        kind: string;
        confidence: number;
        reason: string;
        title: string;
        sourceLabel: string | null;
        documentDate: string | null;
      }
    | null;
  extracted: Record<string, unknown> | null;
  error?: string;
}

const KIND_LABELS: Record<string, string> = {
  BODY_COMPOSITION: "📊 Skład ciała / smart waga",
  BLOOD_TEST: "🩸 Badania krwi",
  HORMONES_TEST: "🧪 Badania hormonalne",
  IMAGING_REPORT: "🩻 Badania obrazowe",
  MEDICATION_LABEL: "💊 Etykieta leku",
  SUPPLEMENT_LABEL: "🌿 Etykieta suplementu",
  WELLNESS_REPORT: "📈 Raport wellness",
  PRESCRIPTION: "📝 Recepta / skierowanie",
  OTHER: "📄 Inne",
};

export interface IntakeFlowProps {
  /** Default ISO date for the resulting record (e.g. today). */
  defaultDate?: string;
  /** Called after successful save. Parent typically refreshes data. */
  onSaved?: (info: { kind: string; targetId: string }) => void;
}

export function IntakeFlow({ defaultDate, onSaved }: IntakeFlowProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPhase({ kind: "idle" });
    setError(null);
  }

  async function classify(meta: UploadResultMeta, forceKind?: string) {
    setError(null);
    setPhase({ kind: "classifying", meta });
    try {
      const res = await fetch(`/api/intake/${meta.intakeId}/classify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: forceKind ? JSON.stringify({ forceKind }) : undefined,
      });
      const data: ClassifyResponse = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setPhase({ kind: "uploaded", meta });
        return;
      }
      setPhase({ kind: "classified", meta, result: data });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Classify failed");
      setPhase({ kind: "uploaded", meta });
    }
  }

  function handleUploaded(meta: UploadResultMeta) {
    setPhase({ kind: "uploaded", meta });
    void classify(meta); // auto-classify
  }

  function forceBloodTest() {
    if (phase.kind !== "classified") return;
    void classify(phase.meta, "BLOOD_TEST");
  }

  // ── Phase: idle / first time ────────────────────────────────────────────
  if (phase.kind === "idle") {
    return (
      <div className="space-y-3">
        <UploadDropzone onUploaded={handleUploaded} />
      </div>
    );
  }

  // ── Phase: uploaded but classify failed → retry ────────────────────────
  if (phase.kind === "uploaded") {
    return (
      <div className="space-y-3">
        <IntakeFilePreview
          url={phase.meta.preview || phase.meta.url}
          mimeType={phase.meta.mimeType}
          fileName={phase.meta.fileName}
          onRemove={reset}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => classify(phase.meta)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Spróbuj ponownie
          </Button>
          <Button size="sm" variant="ghost" onClick={reset}>
            Anuluj
          </Button>
        </div>
      </div>
    );
  }

  // ── Phase: classifying ──────────────────────────────────────────────────
  if (phase.kind === "classifying") {
    return (
      <div className="space-y-3">
        <IntakeFilePreview
          url={phase.meta.preview || phase.meta.url}
          mimeType={phase.meta.mimeType}
          fileName={phase.meta.fileName}
        />
        <div className="flex items-center gap-2 p-3 rounded-md border border-border bg-muted/30 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span>Analizowanie dokumentu…</span>
        </div>
      </div>
    );
  }

  // ── Phase: saved ────────────────────────────────────────────────────────
  if (phase.kind === "saved") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-md border border-green-500/30 bg-green-500/5 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>Zapisano. {phase.targetUrl ? "" : "Możesz dodać kolejny."}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}>
          Dodaj kolejny
        </Button>
      </div>
    );
  }

  // ── Phase: classified — show result + delegate to per-kind form ─────────
  const { meta, result } = phase;
  const c = result.classification;
  const kindLabel = KIND_LABELS[result.kind ?? "OTHER"] ?? "📄 Inne";
  const confPct = c ? Math.round(c.confidence * 100) : 0;
  const confTone =
    confPct >= 80 ? "text-green-600" : confPct >= 50 ? "text-yellow-600" : "text-red-500";

  return (
    <div className="space-y-3">
      <IntakeFilePreview
        url={meta.preview || meta.url}
        mimeType={meta.mimeType}
        fileName={meta.fileName}
        onRemove={reset}
      />



      {/* Per-kind review form */}
      {result.kind === "BODY_COMPOSITION" && result.extracted ? (
        <BodyCompositionReviewForm
          intakeId={meta.intakeId}
          defaultDate={defaultDate}
          extracted={result.extracted}
          sourceLabel={c?.sourceLabel ?? null}
          documentDate={c?.documentDate ?? null}
          onSaved={(info) => {
            setPhase({ kind: "saved", meta, targetUrl: info.targetUrl, targetId: info.targetId });
            onSaved?.({ kind: "BODY_COMPOSITION", targetId: info.targetId });
            router.refresh();
          }}
          onReclassify={() => classify(meta)}
        />
      ) : (result.kind === "BLOOD_TEST" || result.kind === "HORMONES_TEST") && result.extracted ? (
        <BloodTestReviewForm
          intakeId={meta.intakeId}
          defaultDate={defaultDate}
          extracted={result.extracted as any}
          sourceLabel={c?.sourceLabel ?? null}
          documentDate={c?.documentDate ?? null}
          onSaved={(info) => {
            setPhase({ kind: "saved", meta, targetUrl: info.targetUrl, targetId: info.targetId });
            onSaved?.({ kind: result.kind ?? "BLOOD_TEST", targetId: info.targetId });
            router.refresh();
          }}
          onReclassify={() => classify(meta)}
        />
      ) : (
        <UnsupportedKindNotice
          intakeId={meta.intakeId}
          kind={result.kind ?? "OTHER"}
          onDiscard={reset}
          onForceBloodTest={forceBloodTest}
        />
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Notice for unsupported kinds in this sprint ──────────────────────────────

function UnsupportedKindNotice({
  intakeId,
  kind,
  onDiscard,
  onForceBloodTest,
}: {
  intakeId: string;
  kind: string;
  onDiscard: () => void;
  onForceBloodTest: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function reject() {
    setBusy(true);
    try {
      await fetch(`/api/intake/${intakeId}`, {
        method: "DELETE",
      });
    } finally {
      setBusy(false);
      onDiscard();
    }
  }

  return (
    <div className="space-y-3 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 text-sm">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-500 shrink-0" />
        <div>
          <p className="font-medium text-yellow-700 dark:text-yellow-500">
            Ten typ ({kind}) nie jest jeszcze wspierany.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plik jest zapisany w intake'u i można go obejrzeć, ale automatyczne wyciąganie danych
            obsługujemy obecnie tylko dla skanów składu ciała. Dla badań krwi, leków i innych dokumentów
            przyjdzie wsparcie w kolejnych sprintach.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-2">
        <Button size="sm" variant="outline" onClick={reject} disabled={busy} className="w-full sm:w-auto">
          Usuń plik
        </Button>
        <Button
          size="sm"
          onClick={onForceBloodTest}
          disabled={busy}
          className="w-full sm:w-auto bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] font-bold text-xs"
        >
          To jest badanie krwi (Morfologia/Mocz)
        </Button>
      </div>
    </div>
  );
}
