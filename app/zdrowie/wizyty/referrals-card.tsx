"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  FileText,
  Plus,
  Trash2,
  CheckCircle,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { VisitFormModal } from "./visit-form-modal";
import { ExamFormModal } from "./exam-form-modal";
import { type Dictionaries } from "./constants";
import {
  effectiveReferralStatus,
  referralStatusMeta,
  expiryWarning,
  expiryLabel,
  type ReferralStatus,
} from "@/lib/services/referrals";
import { formatVisitDate } from "@/lib/services/visit-dates";

interface Props {
  referrals: any[];
  dictionaries: Dictionaries;
  /** Wywoływane po każdej zmianie — rodzic aktualizuje swój stan. */
  onChanged: (referral: any, action: "upsert" | "delete") => void;
  onAdd: () => void;
}

type Filter = "ALL" | "ACTIVE" | "FULFILLED" | "EXPIRED";

const FILTERS: [Filter, string][] = [
  ["ACTIVE", "Aktywne"],
  ["FULFILLED", "Zrealizowane"],
  ["EXPIRED", "Wygasłe"],
  ["ALL", "Wszystkie"],
];

const WARNING_STYLE: Record<string, string> = {
  urgent: "border-rose-500/40 bg-rose-500/5",
  soon: "border-amber-500/40 bg-amber-500/5",
  expired: "border-rose-500/40 bg-rose-500/5",
  none: "border-[#2e3229]",
};

const WARNING_TEXT: Record<string, string> = {
  urgent: "text-rose-400 font-bold",
  soon: "text-amber-400 font-bold",
  expired: "text-rose-400 font-bold",
  none: "text-[#5d6050]",
};

/**
 * Karta „E-Skierowania".
 *
 * Skierowanie przestaje być wyspą: ma status (zamiast samego `isUsed`), wie
 * z jakiego leczenia wynika i czym zostało zrealizowane. Wygaśnięcie liczymy
 * przy odczycie — nic nie zmienia danych w tle.
 */
export function ReferralsCard({ referrals, dictionaries, onChanged, onAdd }: Props) {
  const [filter, setFilter] = useState<Filter>("ACTIVE");
  /** Skierowanie w trakcie realizacji — otwiera modal wyboru sposobu. */
  const [fulfilling, setFulfilling] = useState<any | null>(null);
  const [mode, setMode] = useState<null | "visit" | "exam" | "attach">(null);

  /**
   * Zamyka cały przepływ realizacji. Formularze wizyty/badania wołają `onClose`
   * także po udanym zapisie — gdyby czyścił sam `mode`, na ekran wracałby modal
   * wyboru, zanim asynchroniczny `markFulfilled` zdąży wyczyścić `fulfilling`.
   */
  function closeFulfilFlow() {
    setFulfilling(null);
    setMode(null);
  }

  const withStatus = useMemo(
    () =>
      referrals.map((r) => ({
        ...r,
        _status: effectiveReferralStatus(r),
        _warning: expiryWarning(r),
        _expiryLabel: expiryLabel(r),
      })),
    [referrals]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: withStatus.length };
    for (const r of withStatus) c[r._status] = (c[r._status] ?? 0) + 1;
    return c;
  }, [withStatus]);

  const shown = useMemo(
    () =>
      filter === "ALL"
        ? withStatus
        : withStatus.filter((r) => r._status === filter),
    [withStatus, filter]
  );

  /** Zapisuje realizację: powiązanie + status FULFILLED. */
  async function markFulfilled(
    referralId: string,
    link: { fulfilledByVisitId?: string; fulfilledByDocumentId?: string }
  ) {
    const res = await fetch(`/api/health/referrals/${referralId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "FULFILLED", ...link }),
    });
    if (res.ok) onChanged(await res.json(), "upsert");
    closeFulfilFlow();
  }

  async function setStatus(referral: any, status: ReferralStatus) {
    const res = await fetch(`/api/health/referrals/${referral.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) onChanged(await res.json(), "upsert");
  }

  async function remove(id: string) {
    if (!confirm("Czy na pewno chcesz usunąć to skierowanie?")) return;
    const res = await fetch(`/api/health/referrals/${id}`, { method: "DELETE" });
    if (res.ok) onChanged({ id }, "delete");
  }

  return (
    <>
      <Card className="bg-[#1a1c18] border-[#2e3229] rounded-xl overflow-hidden">
        <CardHeader className="border-b border-[#2e3229] bg-[#0d0e0c]/30 flex flex-row justify-between items-center py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#bce663]" />
            <CardTitle className="text-sm text-[#f1f2ec]">E-Skierowania</CardTitle>
          </div>
          <Button
            onClick={onAdd}
            size="sm"
            className="bg-[#bce663]/10 hover:bg-[#bce663]/20 text-[#bce663] text-xs font-bold border border-[#bce663]/20 rounded-lg h-8"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Dodaj
          </Button>
        </CardHeader>

        <CardContent className="p-4 space-y-3">
          {/* Filtr statusów */}
          <div className="flex flex-wrap gap-1">
            {FILTERS.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                  filter === key
                    ? "bg-[#bce663] text-[#0d0e0c]"
                    : "text-[#8c9282] hover:text-[#f1f2ec] border border-[#2e3229]"
                }`}
              >
                {label} ({counts[key] ?? 0})
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <div className="p-4 text-center border border-dashed border-[#2e3229] rounded-xl text-[10px] text-[#8c9282] bg-[#0d0e0c]/20">
              Brak skierowań w tej kategorii.
            </div>
          ) : (
            <div className="space-y-2">
              {shown.map((ref) => {
                const meta = referralStatusMeta(ref._status);
                const done = ref._status === "FULFILLED" || ref._status === "CANCELLED";
                return (
                  <div
                    key={ref.id}
                    className={`p-3 rounded-xl border bg-[#0d0e0c]/20 space-y-2 ${
                      WARNING_STYLE[ref._warning]
                    } ${done ? "opacity-70" : ""}`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-semibold text-xs text-[#f1f2ec]" title={ref.title}>
                            {ref.title}
                          </h4>
                          <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#8c9282]">
                          Specjalizacja: {ref.specialization}
                        </p>
                        {ref.doctorName && (
                          <p className="text-[10px] text-[#8c9282]">Lekarz: {ref.doctorName}</p>
                        )}
                        {ref.episode?.title && (
                          <p className="text-[10px] text-[#bce663]">
                            Leczenie: {ref.episode.title}
                          </p>
                        )}
                        {/* Kierunek odwrotny: co z tego skierowania powstało. */}
                        {ref.fulfilledByVisit && (
                          <p className="text-[10px] text-[#8c9282] flex items-center gap-1 mt-0.5">
                            <ArrowRight className="h-3 w-3 text-[#bce663]" />
                            Wizyta: {ref.fulfilledByVisit.doctorName} ·{" "}
                            {formatVisitDate(ref.fulfilledByVisit)}
                          </p>
                        )}
                        {ref.fulfilledByDocument && (
                          <p className="text-[10px] text-[#8c9282] flex items-center gap-1 mt-0.5">
                            <ArrowRight className="h-3 w-3 text-[#bce663]" />
                            Badanie: {ref.fulfilledByDocument.title}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {!done && (
                          <button
                            onClick={() => {
                              setFulfilling(ref);
                              setMode(null);
                            }}
                            className="p-1 text-[#8c9282] hover:text-[#bce663] bg-[#1a1c18] border border-[#2e3229] rounded-md transition-all"
                            title="Zrealizuj skierowanie"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => remove(ref.id)}
                          className="p-1 text-[#8c9282] hover:text-red-400 bg-[#1a1c18] border border-[#2e3229] rounded-md transition-all"
                          title="Usuń"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-[#2e3229] text-[9px]">
                      {ref.code && (
                        <span className="font-mono bg-[#bce663]/10 text-[#bce663] px-1.5 py-0.5 rounded border border-[#bce663]/20">
                          Kod: {ref.code}
                        </span>
                      )}
                      <span className={WARNING_TEXT[ref._warning]}>
                        {ref.expiryDate ? (
                          <>
                            {(ref._warning === "urgent" || ref._warning === "expired") && (
                              <AlertTriangle className="h-3 w-3 inline mr-0.5 -mt-px" />
                            )}
                            {format(new Date(ref.expiryDate), "dd.MM.yyyy")}
                            {ref._expiryLabel && !done ? ` · ${ref._expiryLabel}` : ""}
                          </>
                        ) : (
                          "Brak daty ważności"
                        )}
                      </span>
                    </div>

                    {done && ref._status === "FULFILLED" && (
                      <button
                        onClick={() => setStatus(ref, "ACTIVE")}
                        className="text-[9px] text-[#5d6050] hover:text-[#8c9282] underline underline-offset-2"
                      >
                        Cofnij realizację
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wybór sposobu realizacji */}
      <Modal
        isOpen={!!fulfilling && mode === null}
        onClose={() => setFulfilling(null)}
        title="Zrealizuj skierowanie"
        description={fulfilling?.title}
        size="md"
      >
        <div className="space-y-2">
          {(
            [
              ["visit", "Umów wizytę", "Nowa wizyta z prefillem ze skierowania"],
              ["exam", "Dodaj badanie", "Nowe badanie z prefillem ze skierowania"],
              ["attach", "Podepnij istniejące", "Wybierz z już zapisanych wizyt i badań"],
            ] as const
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className="w-full text-left rounded-lg border border-[#2e3229] bg-[#0d0e0c] px-3 py-2.5 hover:border-[#bce663]/40 transition-all"
            >
              <span className="block text-xs font-bold text-[#f1f2ec]">{label}</span>
              <span className="block text-[10px] text-[#8c9282] mt-0.5">{hint}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Realizacja przez nową wizytę */}
      {fulfilling && mode === "visit" && (
        <VisitFormModal
          open
          onClose={closeFulfilFlow}
          dictionaries={dictionaries}
          presetBodyPart={fulfilling.bodyPart?.name}
          presetSpecialization={fulfilling.specialization}
          presetEpisodeId={fulfilling.episodeId ?? undefined}
          onCreated={(visit) =>
            markFulfilled(fulfilling.id, { fulfilledByVisitId: visit.id })
          }
        />
      )}

      {/* Realizacja przez nowe badanie */}
      {fulfilling && mode === "exam" && (
        <ExamFormModal
          open
          onClose={closeFulfilFlow}
          dictionaries={dictionaries}
          presetBodyPart={fulfilling.bodyPart?.name}
          presetEpisodeId={fulfilling.episodeId ?? undefined}
          onSaved={(doc) =>
            markFulfilled(fulfilling.id, { fulfilledByDocumentId: doc.id })
          }
        />
      )}

      {/* Podpięcie istniejącego rekordu */}
      {fulfilling && mode === "attach" && (
        <AttachExistingModal
          referral={fulfilling}
          onClose={closeFulfilFlow}
          onPick={(link) => markFulfilled(fulfilling.id, link)}
        />
      )}
    </>
  );
}

/** Wybór już istniejącej wizyty lub badania jako realizacji skierowania. */
function AttachExistingModal({
  referral,
  onClose,
  onPick,
}: {
  referral: any;
  onClose: () => void;
  onPick: (link: { fulfilledByVisitId?: string; fulfilledByDocumentId?: string }) => void;
}) {
  const [rows, setRows] = useState<
    { id: string; kind: "visit" | "exam"; title: string; subtitle: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Korzystamy z istniejących endpointów listujących — bez nowej trasy API.
    Promise.all([
      fetch("/api/health/visits").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/health/documents").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([visits, docs]) => {
        if (cancelled) return;
        setRows([
          ...(visits as any[]).map((v) => ({
            id: v.id,
            kind: "visit" as const,
            title: v.doctorName || "Wizyta",
            subtitle: `${v.specialization ?? ""} · ${formatVisitDate(v)}`,
          })),
          ...(docs as any[]).map((d) => ({
            id: d.id,
            kind: "exam" as const,
            title: d.title,
            subtitle: d.studyDate ? format(new Date(d.studyDate), "dd.MM.yyyy") : "",
          })),
        ]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Modal isOpen onClose={onClose} title="Podepnij istniejące" description={referral.title} size="lg">
      {loading ? (
        <p className="text-xs text-[#8c9282]">Wczytywanie…</p>
      ) : (
        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {rows.map((row) => (
            <button
              key={`${row.kind}-${row.id}`}
              type="button"
              onClick={() =>
                onPick(
                  row.kind === "visit"
                    ? { fulfilledByVisitId: row.id }
                    : { fulfilledByDocumentId: row.id }
                )
              }
              className="w-full text-left rounded-lg border border-[#2e3229] bg-[#0d0e0c] px-3 py-2 hover:border-[#bce663]/40 transition-all"
            >
              <span className="block text-xs text-[#f1f2ec]">
                {row.kind === "visit" ? "Wizyta" : "Badanie"}: {row.title}
              </span>
              <span className="block text-[10px] text-[#8c9282]">{row.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
