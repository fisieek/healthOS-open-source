"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  MapPin,
  Stethoscope,
  Pencil,
  Trash2,
  Check,
  X,
  GitMerge,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Kind = "doctors" | "facilities" | "body-parts";

interface Entry {
  id: string;
  name: string;
  usage: number;
  specialization?: string | null;
  notes?: string | null;
  address?: string | null;
}

interface Props {
  doctors: Entry[];
  facilities: Entry[];
  bodyParts: Entry[];
}

export function DictionariesClient({ doctors, facilities, bodyParts }: Props) {
  return (
    <div className="space-y-6">
      <div className="border-b border-[#2e3229] pb-5">
        <Link
          href="/zdrowie"
          className="inline-flex items-center gap-1 text-[10px] font-mono text-[#5d6050] hover:text-[#8c9282] mb-1"
        >
          <ArrowLeft className="h-3 w-3" /> Wizyty i badania
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[#f1f2ec]">Słowniki medyczne</h1>
        <p className="text-sm text-[#8c9282] mt-1">
          Zarządzaj lekarzami, placówkami i częściami ciała. Scalaj duplikaty (np. „tarczyca" i
          „Tarczyca"), zmieniaj nazwy, usuwaj nieużywane. Adres placówki trafia do
          Kalendarza Google jako miejsce zdarzenia.
        </p>
      </div>

      <DictSection
        kind="doctors"
        title="Lekarze"
        icon={<User className="h-4 w-4 text-[#bce663]" />}
        entries={doctors}
        hasSpecialization
      />
      <DictSection
        kind="facilities"
        title="Placówki"
        icon={<MapPin className="h-4 w-4 text-[#bce663]" />}
        entries={facilities}
        hasAddress
      />
      <DictSection
        kind="body-parts"
        title="Powód / Część ciała"
        icon={<Stethoscope className="h-4 w-4 text-[#bce663]" />}
        entries={bodyParts}
        hasNotes
      />
    </div>
  );
}

function DictSection({
  kind,
  title,
  icon,
  entries,
  hasSpecialization,
  hasNotes,
  hasAddress,
}: {
  kind: Kind;
  title: string;
  icon: React.ReactNode;
  entries: Entry[];
  /** Każda sekcja ma najwyżej JEDNO pole dodatkowe — stąd wspólny `editExtra`. */
  hasSpecialization?: boolean;
  hasNotes?: boolean;
  hasAddress?: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editExtra, setEditExtra] = useState("");
  const [mergeFrom, setMergeFrom] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (e: Entry) => {
    setEditingId(e.id);
    setEditName(e.name);
    setEditExtra(
      (hasSpecialization
        ? e.specialization
        : hasNotes
          ? e.notes
          : hasAddress
            ? e.address
            : "") ?? ""
    );
    setError(null);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setBusy(true);
    setError(null);
    const body: Record<string, string> = { name: editName.trim() };
    if (hasSpecialization) body.specialization = editExtra.trim();
    if (hasNotes) body.notes = editExtra.trim();
    if (hasAddress) body.address = editExtra.trim();
    const res = await fetch(`/api/health/dictionaries/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (res.status === 409) {
      setError("Taka nazwa już istnieje — użyj scalania.");
      return;
    }
    if (!res.ok) {
      setError("Nie udało się zapisać.");
      return;
    }
    setEditingId(null);
    router.refresh();
  };

  const doMerge = async (fromId: string) => {
    if (!mergeTarget) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/health/dictionaries/${kind}/${fromId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: mergeTarget }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Scalanie nie powiodło się.");
      return;
    }
    setMergeFrom(null);
    setMergeTarget("");
    router.refresh();
  };

  const doDelete = async (e: Entry) => {
    setError(null);

    // Wpis w użyciu: potwierdź odłączenie z góry i usuń z force.
    if (e.usage > 0) {
      if (
        !confirm(
          `„${e.name}" jest używane w ${e.usage} ${e.usage === 1 ? "miejscu" : "miejscach"}. Odłączyć od nich (zostaną bez tego wpisu) i usunąć?`
        )
      ) {
        return;
      }
      const res = await fetch(`/api/health/dictionaries/${kind}/${e.id}?force=1`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
      else setError("Nie udało się usunąć.");
      return;
    }

    // Wpis nieużywany: proste potwierdzenie. Fallback na 409 (dane mogły się zmienić).
    if (!confirm(`Usunąć „${e.name}"?`)) return;
    let res = await fetch(`/api/health/dictionaries/${kind}/${e.id}`, { method: "DELETE" });
    if (res.status === 409) {
      const j = await res.json().catch(() => ({}));
      const n = j.usageCount ?? 0;
      if (!confirm(`Wpis jest jednak używany w ${n} miejscach. Odłączyć i usunąć?`)) return;
      res = await fetch(`/api/health/dictionaries/${kind}/${e.id}?force=1`, {
        method: "DELETE",
      });
    }
    if (res.ok) router.refresh();
    else setError("Nie udało się usunąć.");
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-bold text-[#f1f2ec] uppercase tracking-wide">{title}</h2>
        <span className="text-[10px] text-[#5d6050]">({entries.length})</span>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      {entries.length === 0 ? (
        <div className="p-6 text-center border border-dashed border-[#2e3229] rounded-xl text-xs text-[#8c9282] bg-[#1a1c18]">
          Brak wpisów. Pojawią się automatycznie przy dodawaniu wizyt i badań.
        </div>
      ) : (
        <div className="rounded-xl border border-[#2e3229] bg-[#1a1c18] divide-y divide-[#2e3229]/60">
          {entries.map((e) => (
            <div key={e.id} className="p-3">
              {editingId === e.id ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Input
                    value={editName}
                    onChange={(ev) => setEditName(ev.target.value)}
                    placeholder="Nazwa"
                    className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs flex-1"
                  />
                  {(hasSpecialization || hasNotes || hasAddress) && (
                    <Input
                      value={editExtra}
                      onChange={(ev) => setEditExtra(ev.target.value)}
                      placeholder={
                        hasSpecialization
                          ? "Specjalizacja"
                          : hasAddress
                            ? "Adres (ulica, miasto)"
                            : "Notatka"
                      }
                      className="bg-[#0d0e0c] border-[#2e3229] text-[#f1f2ec] text-xs flex-1"
                    />
                  )}
                  <div className="flex gap-1">
                    <Button
                      onClick={() => saveEdit(e.id)}
                      disabled={busy}
                      className="bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] p-2 h-auto"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={() => setEditingId(null)}
                      className="bg-transparent border border-[#2e3229] text-[#8c9282] hover:text-white p-2 h-auto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : mergeFrom === e.id ? (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <span className="text-xs text-[#f1f2ec] flex-1">
                    Scal „{e.name}" w:
                  </span>
                  <select
                    value={mergeTarget}
                    onChange={(ev) => setMergeTarget(ev.target.value)}
                    className="rounded-lg bg-[#0d0e0c] border border-[#2e3229] text-[#f1f2ec] text-xs px-3 py-2 outline-none focus:border-[#bce663]/50 flex-1"
                  >
                    <option value="">— wybierz wpis docelowy —</option>
                    {entries
                      .filter((o) => o.id !== e.id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                  </select>
                  <div className="flex gap-1">
                    <Button
                      onClick={() => doMerge(e.id)}
                      disabled={busy || !mergeTarget}
                      className="bg-[#bce663] text-[#0d0e0c] hover:bg-[#a7d152] text-xs font-bold px-3 h-auto py-2"
                    >
                      Scal
                    </Button>
                    <Button
                      onClick={() => {
                        setMergeFrom(null);
                        setMergeTarget("");
                      }}
                      className="bg-transparent border border-[#2e3229] text-[#8c9282] hover:text-white p-2 h-auto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#f1f2ec] truncate">
                      {e.name}
                      {hasSpecialization && e.specialization && (
                        <span className="text-xs text-[#8c9282] font-normal">
                          {" "}
                          · {e.specialization}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-[#5d6050]">
                      {e.usage === 0
                        ? "nieużywane"
                        : `używane w ${e.usage} ${e.usage === 1 ? "miejscu" : "miejscach"}`}
                      {hasNotes && e.notes ? ` · ${e.notes}` : ""}
                    </p>
                    {hasAddress && (
                      <p className="text-[10px] text-[#5d6050] truncate">
                        {e.address ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5 shrink-0" /> {e.address}
                          </span>
                        ) : (
                          <span className="text-amber-300/70">
                            brak adresu — nie trafi do kalendarza
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {entries.length > 1 && (
                      <button
                        onClick={() => {
                          setMergeFrom(e.id);
                          setMergeTarget("");
                        }}
                        title="Scal z innym wpisem"
                        className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white"
                      >
                        <GitMerge className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(e)}
                      title={hasAddress ? "Zmień nazwę / adres" : "Zmień nazwę"}
                      className="rounded-lg p-1.5 text-[#8c9282] hover:bg-[#2e3229] hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => doDelete(e)}
                      title="Usuń"
                      className="rounded-lg p-1.5 text-[#8c9282] hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
