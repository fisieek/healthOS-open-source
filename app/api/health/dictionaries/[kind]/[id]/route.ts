import { auth } from "@/auth";
import {
  ownsEntry,
  renameEntry,
  deleteEntry,
  usageCount,
  type DictionaryKind,
} from "@/lib/services/medical-dictionaries";

export const runtime = "nodejs";

const KINDS: DictionaryKind[] = ["doctors", "facilities", "body-parts"];
function isKind(k: string): k is DictionaryKind {
  return (KINDS as string[]).includes(k);
}

export async function PATCH(
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
  if (!(await ownsEntry(kind, session.user.id, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  try {
    const updated = await renameEntry(kind, session.user.id, id, {
      name: body?.name,
      specialization: body?.specialization,
      notes: body?.notes,
      address: body?.address,
    });
    return Response.json(updated);
  } catch (err: unknown) {
    // Kolizja unikalności (nazwa już istnieje) → 409
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
      return Response.json({ error: "Taka nazwa już istnieje" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(
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
  if (!(await ownsEntry(kind, session.user.id, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const used = await usageCount(kind, session.user.id, id);
  if (used > 0 && !force) {
    return Response.json(
      { error: "in_use", usageCount: used },
      { status: 409 }
    );
  }

  await deleteEntry(kind, id);
  return Response.json({ ok: true, unlinked: used });
}
