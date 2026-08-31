import { auth } from "@/auth";
import {
  ownsEntry,
  mergeEntries,
  type DictionaryKind,
} from "@/lib/services/medical-dictionaries";

export const runtime = "nodejs";

const KINDS: DictionaryKind[] = ["doctors", "facilities", "body-parts"];
function isKind(k: string): k is DictionaryKind {
  return (KINDS as string[]).includes(k);
}

/** Scala wpis [id] (źródłowy) w docelowy targetId — przepina FK i usuwa źródłowy. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isKind(kind)) {
    return Response.json({ error: "Unknown dictionary kind" }, { status: 404 });
  }

  const body = await request.json();
  const targetId = (body?.targetId ?? "").trim();
  if (!targetId) {
    return Response.json({ error: "targetId is required" }, { status: 400 });
  }
  if (targetId === id) {
    return Response.json({ error: "Nie można scalić wpisu z samym sobą" }, { status: 400 });
  }

  const [ownsFrom, ownsTo] = await Promise.all([
    ownsEntry(kind, session.user.id, id),
    ownsEntry(kind, session.user.id, targetId),
  ]);
  if (!ownsFrom || !ownsTo) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await mergeEntries(kind, session.user.id, id, targetId);
  return Response.json({ ok: true });
}
