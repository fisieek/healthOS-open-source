import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  listEpisodes,
  createEpisode,
  isEpisodeStatus,
} from "@/lib/services/care-episodes";
import { resolveBodyPartId } from "@/lib/services/medical-dictionaries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const bodyPartId = new URL(request.url).searchParams.get("bodyPartId");
  return Response.json(await listEpisodes(session.user.id, bodyPartId));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const body = await request.json();

  const title = (body?.title ?? "").trim();
  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  // Część ciała po id albo po nazwie (find-or-create, jak w wizytach i badaniach).
  const bodyPartId =
    body?.bodyPartId || (await resolveBodyPartId(userId, body?.bodyPart));
  if (!bodyPartId) {
    return Response.json(
      { error: "bodyPartId or bodyPart is required" },
      { status: 400 }
    );
  }

  const owns = await prisma.bodyPart.findFirst({
    where: { id: bodyPartId, userId },
    select: { id: true },
  });
  if (!owns) {
    return Response.json({ error: "Body part not found" }, { status: 404 });
  }

  const episode = await createEpisode(userId, {
    bodyPartId,
    title,
    status: isEpisodeStatus(body?.status) ? body.status : undefined,
    startDate: body?.startDate,
    endDate: body?.endDate,
    outcome: body?.outcome,
    notes: body?.notes,
  });
  return Response.json(episode, { status: 201 });
}
