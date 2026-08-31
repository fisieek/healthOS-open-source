import { auth } from "@/auth";
import { getEpisodeReport } from "@/lib/services/episode-report";

export const runtime = "nodejs";

/**
 * GET /api/health/export?episodeId=...
 *
 * Pełna historia epizodu w JSON. Powstaje przy okazji raportu dla lekarza —
 * warstwa zbierania danych jest ta sama, więc to praktycznie darmowe.
 *
 * Zastosowania: kopia zapasowa niezależna od pliku `.db`, przeniesienie do innej
 * aplikacji, wejście dla asystenta AI.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const episodeId = new URL(request.url).searchParams.get("episodeId");
  if (!episodeId) {
    return Response.json({ error: "Parametr episodeId jest wymagany." }, { status: 400 });
  }

  const report = await getEpisodeReport(session.user.id, episodeId);
  if (!report) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const fileName = `healthOS-${report.episode.title.replace(/[^\p{L}\p{N}]+/gu, "-")}.json`;

  return new Response(JSON.stringify(report, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    },
  });
}
