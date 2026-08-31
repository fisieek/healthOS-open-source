import { auth } from "@/auth";
import { listDictionaries } from "@/lib/services/medical-dictionaries";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dicts = await listDictionaries(session.user.id);
  return Response.json(dicts);
}
