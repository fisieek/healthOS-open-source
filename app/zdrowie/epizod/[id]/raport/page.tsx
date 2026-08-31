import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";
import { getEpisodeReport, type ReportEntry } from "@/lib/services/episode-report";
import { episodeStatusMeta } from "@/app/zdrowie/wizyty/constants";
import { referralStatusMeta } from "@/lib/services/referrals";
import { PrintButton } from "./print-button";

/**
 * Raport „historia leczenia" — jedna kartka dla nowego specjalisty.
 *
 * Opcje przychodzą przez query string, nie przez stan klienta: dzięki temu
 * adres raportu jest przewidywalny, da się go zakładkować i wysłać, a strona
 * zostaje w całości serwerowa.
 *
 * Zamiast generatora PDF używamy `@media print` + `Cmd+P` — ten sam efekt,
 * bez dokładania `jspdf`/`puppeteer` do paczki desktopowej.
 */

const KIND_LABEL: Record<string, string> = {
  VISIT: "WIZYTA",
  EXAM: "BADANIE",
  DENTAL: "ZABIEG",
};

function fmt(d: Date | null, pattern = "dd.MM.yyyy"): string {
  return d ? format(d, pattern) : "termin nieustalony";
}

function flag(v: boolean | undefined, dflt: boolean): boolean {
  return v === undefined ? dflt : v;
}

export default async function EpisodeReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const sp = await searchParams;
  const report = await getEpisodeReport(session.user.id, id);
  if (!report) notFound();

  // Opcje z 10d — domyślnie wszystko poza obrazami.
  const showPatient = flag(sp.patient === undefined ? undefined : sp.patient !== "0", true);
  const fullDescriptions = sp.desc !== "short";
  const showMeds = sp.meds !== "0";
  const showReferrals = sp.refs !== "0";
  const showAttachments = sp.files !== "0";

  const { episode, patient, timeline, planned, medications, referrals, attachments, counts } =
    report;

  const activeMeds = medications.filter((m) => !m.endDate);
  const pastMeds = medications.filter((m) => m.endDate);

  const renderEntry = (e: ReportEntry) => (
    <div key={`${e.kind}-${e.id}`} className="report-entry">
      <div className="entry-date">{fmt(e.date)}</div>
      <div className="entry-body">
        <p className="entry-head">
          <strong>{KIND_LABEL[e.kind]}</strong>
          {e.doctor ? ` · ${e.doctor}` : ""}
          {e.subtitle && e.subtitle !== e.doctor ? ` · ${e.subtitle}` : ""}
        </p>
        {e.kind !== "VISIT" && <p className="entry-title">{e.title}</p>}
        {e.facility && e.facility !== e.subtitle && (
          <p className="entry-meta">{e.facility}</p>
        )}
        {e.summary && (
          <p className="entry-line">
            <span className="lbl">Rozpoznanie / wnioski:</span> {e.summary}
          </p>
        )}
        {fullDescriptions && e.description && (
          <p className="entry-line entry-desc">{e.description}</p>
        )}
        {e.recommendations && (
          <p className="entry-line">
            <span className="lbl">Zalecenia:</span> {e.recommendations}
          </p>
        )}

        {e.parameters.length > 0 && (
          <table className="params">
            <thead>
              <tr>
                <th>Parametr</th>
                <th>Wynik</th>
                <th>Norma</th>
              </tr>
            </thead>
            <tbody>
              {e.parameters.map((p) => (
                <tr key={p.name} className={p.status === "HIGH" || p.status === "LOW" ? "abnormal" : ""}>
                  <td>{p.name}</td>
                  <td>
                    {p.value} {p.unit}
                    {p.status === "HIGH" && <span className="arrow"> ▲ POZA NORMĄ</span>}
                    {p.status === "LOW" && <span className="arrow"> ▼ POZA NORMĄ</span>}
                  </td>
                  <td>{p.norm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {e.followUpDate && (
          <p className="entry-line followup">
            ► Kontrola zalecona na {fmt(e.followUpDate)}
            {e.followUpNote ? ` — ${e.followUpNote}` : ""}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <style
        // Arkusz druku: wymuszamy jasne tło i czarny tekst. Apka jest ciemna,
        // a wydruk na czarnym tle to katastrofa dla czytelności i tonera.
        dangerouslySetInnerHTML={{
          __html: `
.report-root {
  background: #ffffff;
  color: #111111;
  max-width: 210mm;
  margin: 0 auto;
  padding: 16mm 14mm;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", Helvetica, Arial, sans-serif;
  font-size: 11.5px;
  line-height: 1.45;
}
.report-root h1 { font-size: 17px; margin: 0; letter-spacing: .02em; }
.report-root h2 {
  font-size: 11px; text-transform: uppercase; letter-spacing: .08em;
  margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #111;
}
.report-root p { margin: 2px 0; }
.rep-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.rep-meta { font-size: 10px; color: #444; text-align: right; }
.rep-sub { font-size: 13px; font-weight: 600; margin-top: 2px; }
.rep-line { font-size: 11px; color: #333; }

.report-entry { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px dotted #bbb; page-break-inside: avoid; break-inside: avoid; }
.report-entry:last-child { border-bottom: 0; }
.entry-date { flex: 0 0 74px; font-variant-numeric: tabular-nums; color: #444; }
.entry-body { flex: 1; min-width: 0; }
.entry-head { font-size: 11px; }
.entry-title { font-weight: 600; }
.entry-meta { font-size: 10.5px; color: #555; }
.entry-line { font-size: 11px; }
.entry-desc { white-space: pre-wrap; color: #222; }
.lbl { font-weight: 600; }
.followup { font-weight: 600; }

table.params { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10.5px; }
table.params th { text-align: left; font-weight: 600; border-bottom: 1px solid #999; padding: 2px 4px; }
table.params td { padding: 2px 4px; border-bottom: 1px solid #eee; }
table.params tr.abnormal td { font-weight: 700; }
.arrow { font-weight: 700; }

ul.plain { margin: 4px 0; padding-left: 16px; }
ul.plain li { margin: 1px 0; page-break-inside: avoid; }

.rep-footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #111; font-size: 9.5px; color: #555; display: flex; justify-content: space-between; }
.rep-actions { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; }
.rep-empty { color: #666; font-style: italic; }

@media print {
  @page { size: A4; margin: 14mm; }
  html, body { background: #ffffff !important; }
  /* Nawigacja aplikacji i przyciski nie mają prawa trafić na kartkę. */
  nav, aside, header, .no-print { display: none !important; }

  /* Powłoka aplikacji to h-screen + overflow:hidden, a treść raportu siedzi
     w przewijanym <main>. Bez tego drukarka dostałaby tylko pierwszy ekran.
     :has() celuje wyłącznie w przodków raportu — wnętrze zostaje nietknięte. */
  html, body, main, div:has(.report-root) {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    display: block !important;
  }

  .report-root { max-width: none; margin: 0; padding: 0; font-size: 10.5px; }
  .report-entry { border-bottom: 1px dotted #999; }
}
          `,
        }}
      />

      <div className="report-root">
        <div className="rep-actions no-print">
          <Link
            href="/zdrowie"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2e3229] px-3 py-2 text-xs font-bold text-[#555] hover:bg-[#eee] transition-all"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Wróć
          </Link>
          <PrintButton />
          <span style={{ fontSize: 10, color: "#666" }}>
            Wydruk jest czarno-biały i bez nawigacji — podgląd zobaczysz w Cmd+P.
          </span>
        </div>

        <div className="rep-head">
          <div>
            <h1>HISTORIA LECZENIA</h1>
            <p className="rep-sub">
              {episode.bodyPartName} — {episode.title}
            </p>
            {showPatient && (patient.name || patient.birthDate) && (
              <p className="rep-line">
                Pacjent: {patient.name ?? "—"}
                {patient.birthDate
                  ? `, ur. ${format(patient.birthDate, "yyyy-MM-dd")}`
                  : ""}
                {patient.ageYears != null ? ` (${patient.ageYears} l.)` : ""}
              </p>
            )}
            <p className="rep-line">
              Status: {episodeStatusMeta(episode.status).label} · od{" "}
              {format(episode.startDate, "d MMMM yyyy", { locale: pl })}
              {episode.endDate
                ? ` do ${format(episode.endDate, "d MMMM yyyy", { locale: pl })}`
                : ""}
            </p>
          </div>
          <div className="rep-meta">
            wygenerowano
            <br />
            {format(report.generatedAt, "dd.MM.yyyy HH:mm")}
          </div>
        </div>

        <h2>Podsumowanie</h2>
        <p>
          {counts.visits} wizyt · {counts.examsDone} badań wykonanych ·{" "}
          {counts.examsPlanned} zaplanowanych · {counts.medications} leków
        </p>
        {report.leadDoctors.length > 0 && (
          <p className="rep-line">Prowadzący: {report.leadDoctors.join(", ")}</p>
        )}
        {episode.outcome && <p className="rep-line">Wynik leczenia: {episode.outcome}</p>}
        {episode.notes && <p className="rep-line">Uwagi: {episode.notes}</p>}

        {showMeds && activeMeds.length > 0 && (
          <>
            <h2>Aktualne leki</h2>
            <ul className="plain">
              {activeMeds.map((m) => (
                <li key={m.id}>
                  <strong>{m.name}</strong>
                  {m.dose ? ` ${m.dose}` : ""}
                  {m.frequency ? ` — ${m.frequency}` : ""}, od{" "}
                  {format(m.startDate, "dd.MM.yyyy")} (nadal)
                </li>
              ))}
            </ul>
          </>
        )}

        {showMeds && pastMeds.length > 0 && (
          <>
            <h2>Leki zakończone</h2>
            <ul className="plain">
              {pastMeds.map((m) => (
                <li key={m.id}>
                  {m.name}
                  {m.dose ? ` ${m.dose}` : ""} — {format(m.startDate, "dd.MM.yyyy")} →{" "}
                  {format(m.endDate!, "dd.MM.yyyy")}
                </li>
              ))}
            </ul>
          </>
        )}

        <h2>Przebieg — chronologicznie</h2>
        {timeline.length === 0 ? (
          <p className="rep-empty">Brak zarejestrowanych zdarzeń.</p>
        ) : (
          timeline.map(renderEntry)
        )}

        {planned.length > 0 && (
          <>
            <h2>Zaplanowane</h2>
            {planned.map(renderEntry)}
          </>
        )}

        {showReferrals && referrals.length > 0 && (
          <>
            <h2>Skierowania</h2>
            <ul className="plain">
              {referrals.map((r) => (
                <li key={r.id}>
                  {r.title} ({r.specialization}) — wystawione{" "}
                  {format(r.issueDate, "dd.MM.yyyy")}
                  {r.expiryDate ? `, ważne do ${format(r.expiryDate, "dd.MM.yyyy")}` : ""} ·{" "}
                  {referralStatusMeta(r.status).label}
                </li>
              ))}
            </ul>
          </>
        )}

        {showAttachments && attachments.length > 0 && (
          <>
            <h2>Załączniki</h2>
            <ul className="plain">
              {attachments.map((a, i) => (
                <li key={a.url}>
                  {i + 1}. {a.name}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="rep-footer">
          <span>
            healthOS · {episode.bodyPartName} — {episode.title}
          </span>
          <span>wygenerowano {format(report.generatedAt, "dd.MM.yyyy HH:mm")}</span>
        </div>
      </div>
    </>
  );
}
