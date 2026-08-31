"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  episodeId: string;
  episodeTitle: string;
}

type OptionKey = "patient" | "fullDesc" | "meds" | "refs" | "files";

const OPTIONS: { key: OptionKey; label: string; hint?: string }[] = [
  {
    key: "patient",
    label: "Dane pacjenta (imię, data urodzenia, wiek)",
    hint: "Odznacz, jeśli raport idzie mailem albo do kogoś spoza gabinetu.",
  },
  { key: "fullDesc", label: "Pełne opisy badań", hint: "Odznaczone = tylko wnioski." },
  { key: "meds", label: "Leki" },
  { key: "refs", label: "Skierowania" },
  { key: "files", label: "Lista załączników" },
];

/**
 * Opcje raportu (poz. 10d) — bo nie każdemu lekarzowi daje się wszystko.
 *
 * Wybory idą do query stringa, a nie do stanu klienta: strona raportu zostaje
 * w całości serwerowa, a jej adres da się zakładkować i wysłać.
 */
export function ReportOptionsModal({ open, onClose, episodeId, episodeTitle }: Props) {
  const [selected, setSelected] = useState<Record<OptionKey, boolean>>({
    patient: true,
    fullDesc: true,
    meds: true,
    refs: true,
    files: true,
  });

  function toggle(key: OptionKey) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function buildUrl() {
    const p = new URLSearchParams();
    if (!selected.patient) p.set("patient", "0");
    if (!selected.fullDesc) p.set("desc", "short");
    if (!selected.meds) p.set("meds", "0");
    if (!selected.refs) p.set("refs", "0");
    if (!selected.files) p.set("files", "0");
    const qs = p.toString();
    return `/zdrowie/epizod/${episodeId}/raport${qs ? `?${qs}` : ""}`;
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Eksportuj dla lekarza"
      description={episodeTitle}
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          {OPTIONS.map((o) => (
            <label
              key={o.key}
              className="flex items-start gap-2 rounded-lg border border-[#2e3229] bg-[#0d0e0c] px-3 py-2 cursor-pointer hover:border-[#bce663]/30 transition-all"
            >
              <input
                type="checkbox"
                checked={selected[o.key]}
                onChange={() => toggle(o.key)}
                className="h-3.5 w-3.5 accent-[#bce663] mt-0.5 shrink-0"
              />
              <span>
                <span className="block text-xs text-[#f1f2ec]">{o.label}</span>
                {o.hint && (
                  <span className="block text-[10px] text-[#8c9282] mt-0.5">{o.hint}</span>
                )}
              </span>
            </label>
          ))}
        </div>

        <p className="text-[10px] text-[#5d6050]">
          Raport otworzy się jako strona do druku — białe tło, bez nawigacji.
          W przeglądarce Cmd+P → „Zapisz jako PDF".
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-transparent border border-[#2e3229] text-[#8c9282] hover:bg-[#2e3229] hover:text-white font-bold text-xs"
          >
            Anuluj
          </Button>
          <a
            href={`/api/health/export?episodeId=${episodeId}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#2e3229] px-4 py-2 text-xs font-bold text-[#8c9282] hover:bg-[#2e3229] hover:text-white transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            Pobierz JSON
          </a>
          <a
            href={buildUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#bce663] px-4 py-2 text-xs font-bold text-[#0d0e0c] hover:bg-[#a7d152] transition-all"
          >
            <Printer className="h-3.5 w-3.5" />
            Otwórz raport
          </a>
        </div>
      </div>
    </Modal>
  );
}
