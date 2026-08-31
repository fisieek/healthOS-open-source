import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/services/storage";

export const runtime = "nodejs";

/**
 * GET /api/storage/<...key>
 *
 * Serves files from the configured storage driver. Auth-checked: only the owner
 * of the originating record (HealthIntake or BodyMeasurement.photoKey) can read.
 *
 * Falls back to 404 if the key isn't owned by the requester. We don't leak
 * existence: any unauthorized access looks identical to "not found".
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Not found", { status: 404 });
  }

  const { key: keyParts } = await params;
  const storageKey = keyParts.map((p) => decodeURIComponent(p)).join("/");

  // Verify ownership: the key must belong to one of this user's records.
  const [intake, body, healthDoc] = await Promise.all([
    prisma.healthIntake.findFirst({
      where: { storageKey, userId: session.user.id },
      select: { id: true },
    }),
    prisma.bodyMeasurement.findFirst({
      where: { photoKey: storageKey, userId: session.user.id },
      select: { id: true },
    }),
    prisma.healthDocument.findFirst({
      where: {
        userId: session.user.id,
        fileUrl: {
          in: [
            `/api/storage/${storageKey}`,
            `/api/storage/${encodeURI(storageKey)}`
          ]
        }
      },
      select: { id: true },
    }),
  ]);
  if (!intake && !body && !healthDoc) {
    return new Response("Not found", { status: 404 });
  }

  const file = await storage.get(storageKey);
  if (!file) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(file.data.length),
    },
  });
}
