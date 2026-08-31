"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, ExternalLink, ChevronDown, ChevronUp, Pencil, Link2, Stethoscope } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ExamFormModal } from "@/app/zdrowie/wizyty/exam-form-modal";
import type { Dictionaries } from "@/app/zdrowie/wizyty/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HealthDocument {
  id: string;
  title: string;
  type: string;
  studyDate: string;
  laboratory: string | null;
  doctor: string | null;
  description: string | null;
  tags: string[];
  fileUrl: string | null;
  parameters: Record<string, { value: string; unit?: string }> | null;
  // Przypisanie — decyduje, czy wynik pojawi się w widoku „Wg części ciała".
  bodyPartId?: string | null;
  bodyPart?: { id: string; name: string } | null;
  episodeId?: string | null;
  episode?: { id: string; title: string; status: string } | null;
  status?: string;
  plannedDate?: string | null;
  visitId?: string | null;
  orderingDoctor?: { id: string; name: string; specialization: string | null } | null;
  performingDoctor?: { id: string; name: string; specialization: string | null } | null;
  facilityRef?: { id: string; name: string } | null;
}

interface Props {
  documents: HealthDocument[];
  /** Gdy podane — włącza edycję i przypisywanie wyników do części ciała/leczenia. */
  dictionaries?: Dictionaries;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  BLOOD_TEST: "Badanie krwi",
  HORMONES: "Hormony",
  IMAGING: "Obrazowanie",
  URINE_TEST: "Badanie moczu",
  GENETIC: "Genetyka",
  OTHER: "Inne",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  BLOOD_TEST: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  HORMONES: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  IMAGING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  URINE_TEST: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  GENETIC: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DocumentsManager({ documents, dictionaries }: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editDoc, setEditDoc] = useState<HealthDocument | null>(null);

  const filteredDocuments = filter ? documents.filter((d) => d.type === filter) : documents;

  async function handleDelete(id: string) {
    if (!confirm("Usunąć ten dokument?")) return;
    const res = await fetch(`/api/health/documents/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const presentTypes = [...new Set(documents.map((d) => d.type))];

  if (documents.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
        Brak wyników badań. Kliknij "Dodaj" w nagłówku.
      </div>
    );
  }

  return (
    <div className="bg-[#1a1c18] border border-[#2e3229] rounded-xl p-4 md:p-6 space-y-4">
      {/* Filter buttons */}
      {presentTypes.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilter(null)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              filter === null
                ? "bg-[#bce663] text-[#0d0e0c] font-bold"
                : "bg-[#1a1c18] text-[#8c9282] hover:text-white border border-[#2e3229]"
            }`}
          >
            Wszystkie
          </button>
          {presentTypes.map((type) => (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? null : type)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${
                filter === type
                  ? "bg-[#bce663] text-[#0d0e0c] font-bold"
                  : "bg-[#1a1c18] text-[#8c9282] hover:text-white border border-[#2e3229]"
              }`}
            >
              {DOC_TYPE_LABELS[type] || type}
            </button>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <>
          {presentTypes.length > 1 && <Separator />}

          {/* Documents list */}
          {filteredDocuments.length === 0 ? (
            <p className="text-xs text-[#8c9282] py-8 text-center">
              Brak wyników dla wybranego filtra.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map((doc) => {
                const isExpanded = expandedId === doc.id;
                const hasParams = doc.parameters && Object.keys(doc.parameters).length > 0;
                return (
                  <Card key={doc.id} className="p-4 bg-[#141511] border-[#2e3229]">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] ${DOC_TYPE_COLORS[doc.type] || ""}`}
                          >
                            {DOC_TYPE_LABELS[doc.type] || doc.type}
                          </Badge>
                          <span className="text-xs text-[#8c9282]">
                            {format(new Date(doc.studyDate), "d MMM yyyy", { locale: pl })}
                          </span>
                          {doc.laboratory && <span className="text-xs text-[#8c9282]"> • {doc.laboratory}</span>}
                          {doc.doctor && <span className="text-xs text-[#8c9282]"> • {doc.doctor}</span>}
                        </div>
                        <p className="text-sm font-medium text-[#f1f2ec]">{doc.title}</p>
                        {dictionaries && doc.bodyPart?.name && (
                          <p className="flex items-center gap-1.5 text-xs">
                            <Stethoscope className="h-3 w-3 text-[#8c9282] shrink-0" />
                            <span className="text-[#8c9282]">
                              {doc.bodyPart.name}
                              {doc.episode?.title ? ` · ${doc.episode.title}` : ""}
                            </span>
                          </p>
                        )}
                        {doc.description && <p className="text-xs text-[#8c9282]">{doc.description}</p>}
                        {doc.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {doc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-[#2e3229] text-[#8c9282]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {doc.fileUrl && (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#bce663] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> Otwórz plik
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {hasParams && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                            title={isExpanded ? "Zwiń wyniki" : "Pokaż wyniki"}
                            className="text-[#5d6050] hover:text-[#f1f2ec] p-1"
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        {dictionaries && !doc.bodyPart?.name && (
                          <button
                            onClick={() => setEditDoc(doc)}
                            title="Przypisz do części ciała"
                            aria-label="Przypisz do części ciała"
                            className="text-amber-300 hover:text-amber-200 p-1"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {dictionaries && (
                          <button
                            onClick={() => setEditDoc(doc)}
                            title="Edytuj wynik"
                            className="text-[#5d6050] hover:text-[#bce663] p-1"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          title="Usuń wynik"
                          className="text-[#5d6050] hover:text-red-400 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {isExpanded && hasParams && (
                      <div className="mt-3 pt-3 border-t border-[#2e3229]">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[#8c9282]">
                              <th className="text-left font-medium pb-1">Parametr</th>
                              <th className="text-left font-medium pb-1">Wartość</th>
                              <th className="text-left font-medium pb-1">Jednostka</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(doc.parameters!).map(([key, val]) => (
                              <tr key={key} className="border-t border-dashed border-[#2e3229]">
                                <td className="py-1 font-medium text-[#f1f2ec]">{key}</td>
                                <td className="py-1 text-[#f1f2ec]">{val.value}</td>
                                <td className="py-1 text-[#8c9282]">{val.unit || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {dictionaries && (
        <ExamFormModal
          key={`doc-edit-${editDoc?.id ?? "none"}`}
          open={!!editDoc}
          onClose={() => setEditDoc(null)}
          dictionaries={dictionaries}
          editExam={editDoc}
          onSaved={() => {
            setEditDoc(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
