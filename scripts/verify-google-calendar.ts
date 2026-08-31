/**
 * Podgląd „na sucho": co poleciałoby do Kalendarza Google dla danego konta.
 *
 *   npx tsx scripts/verify-google-calendar.ts test@test.pl
 *
 * **Nic nie wysyła i niczego nie zapisuje.** Liczy dokładnie to samo, co trasa
 * `GET /api/integrations/google-calendar/sync`, ale bez sesji i bez sieci —
 * dzięki temu treść zdarzeń da się sprawdzić, zanim ktokolwiek podłączy konto
 * Google. To jest ten „najpierw zobacz, co wyjdzie na zewnątrz" z planu.
 */

import { collectAgendaItems } from "../lib/services/health-agenda";
import {
  buildCalendarEvent,
  hashEvent,
  withinSyncWindow,
} from "../lib/constants/calendar-events";
import { prisma } from "../lib/db";

async function main() {
  const email = process.argv[2] ?? "test@test.pl";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ Nie znaleziono konta ${email}`);
    process.exit(1);
  }

  const items = await collectAgendaItems(user.id);
  const now = new Date();

  const sending: string[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    if (!withinSyncWindow(item, now)) {
      skipped.push(
        `  ${item.kind.padEnd(16)} ${item.title} — ${item.date ? "poza oknem" : "termin nieustalony"}`
      );
      continue;
    }
    const event = buildCalendarEvent(item);
    if (!event) continue;
    const loc = event.location ? `\n     📍 ${event.location}` : "";
    sending.push(
      `  ${event.start.date}  ${event.summary}${loc}\n     ${item.kind} · hash ${hashEvent(event)}`
    );
  }

  console.log(`\nKonto: ${email}`);
  console.log(`Pozycji w agendzie: ${items.length}\n`);
  console.log(`═══ POLECI DO GOOGLE (${sending.length}) ═══`);
  console.log(sending.sort().join("\n") || "  (nic)");
  console.log(`\n═══ POMINIĘTE (${skipped.length}) ═══`);
  console.log(skipped.join("\n") || "  (nic)");
  console.log(
    "\nOpis zdarzeń jest pusty — do Google idą wyłącznie tytuł, data i adres.\n"
  );
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
