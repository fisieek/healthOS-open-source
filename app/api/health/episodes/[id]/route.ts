import { auth } from "@/auth";
import {
  ownsEpisode,
  updateEpisode,
  deleteEpisode,
  isEpisodeStatus,
} from "@/lib/services/care-episodes";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await ownsEpisode(session.user.id, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  if (body?.status !== undefined && !isEpisodeStatus(body.status)) {
    return Response.json({ error: "Unknown status" }, { status: 400 });
  }
  if (body?.title !== undefined && !String(body.title).trim()) {
    return Response.json({ error: "title cannot be empty" }, { status: 400 });
  }

  const episode = await updateEpisode(id, {
    title: body?.title,
    status: body?.status,
    startDate: body?.startDate,
    endDate: body?.endDate,
    outcome: body?.outcome,
    notes: body?.notes,
  });
  return Response.json(episode);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await ownsEpisode(session.user.id, id))) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // FK są SET NULL — wizyty i badania zostają, tracą tylko przypisanie do epizodu.
  await deleteEpisode(id);
  return Response.json({ ok: true });
}
