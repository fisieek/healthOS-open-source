import { auth } from "@/auth";
import { saveHevyApiKey } from "@/lib/services/hevy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  if (!apiKey) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  await saveHevyApiKey(session.user.id, apiKey);
  return Response.json({ ok: true });
}
