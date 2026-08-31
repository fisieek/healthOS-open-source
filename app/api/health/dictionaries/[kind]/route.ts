import { auth } from "@/auth";
import { createEntry, type DictionaryKind } from "@/lib/services/medical-dictionaries";

export const runtime = "nodejs";

const KINDS: DictionaryKind[] = ["doctors", "facilities", "body-parts"];
function isKind(k: string): k is DictionaryKind {
  return (KINDS as string[]).includes(k);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { kind } = await params;
  if (!isKind(kind)) {
    return Response.json({ error: "Unknown dictionary kind" }, { status: 404 });
  }

  const body = await request.json();
  const name = (body?.name ?? "").trim();
  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const entry = await createEntry(kind, session.user.id, {
    name,
    specialization: body?.specialization,
    notes: body?.notes,
  });
  return Response.json(entry, { status: 201 });
}
