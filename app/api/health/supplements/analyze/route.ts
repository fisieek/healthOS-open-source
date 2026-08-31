import { auth } from "@/auth";
import { analyzeSupplementLabel } from "@/lib/services/gemini";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { imageBase64, mimeType } = body;

  if (!imageBase64 || !mimeType) {
    return Response.json({ error: "imageBase64 and mimeType are required" }, { status: 400 });
  }

  try {
    const result = await analyzeSupplementLabel(session.user.id, imageBase64, mimeType);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
