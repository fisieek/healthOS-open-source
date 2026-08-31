/**
 * Walidacja adresu kalendarza Runna.
 *
 * Wcześniej sprawdzaliśmy `url.includes("runna.com") && url.endsWith(".ics")`,
 * co przepuszczało adresy w rodzaju `http://192.168.1.1/runna.com/x.ics` —
 * czyli dowolny host, byle w ścieżce był ten tekst. Tutaj patrzymy na
 * prawdziwą nazwę domeny, a nie na wystąpienie tekstu w adresie.
 *
 * Moduł celowo nie importuje niczego (w szczególności `prisma`), bo używa go
 * zarówno trasa API, jak i komponent kliencki ustawień.
 */

const RUNNA_HOST = "runna.com";

export function isValidRunnaCalendarUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;

  const host = url.hostname.toLowerCase();
  if (host !== RUNNA_HOST && !host.endsWith(`.${RUNNA_HOST}`)) return false;

  return url.pathname.toLowerCase().endsWith(".ics");
}

/** Komunikat pokazywany, gdy adres nie przejdzie walidacji. */
export const RUNNA_URL_HINT =
  "Adres musi zaczynać się od https://, prowadzić do domeny runna.com i kończyć się na .ics";
