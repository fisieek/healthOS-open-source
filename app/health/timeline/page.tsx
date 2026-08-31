import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Heart } from "lucide-react";
import { TimelineManager } from "./timeline-manager";
import Link from "next/link";

export default async function TimelinePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [events, documents] = await Promise.all([
    prisma.healthEvent.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      include: { document: { select: { id: true, title: true } } },
    }),
    prisma.healthDocument.findMany({
      where: { userId },
      orderBy: { studyDate: "desc" },
      select: { id: true, title: true, type: true },
    }),
  ]);

  const serializedEvents = events.map((e) => ({
    id: e.id,
    type: e.type,
    date: e.date.toISOString(),
    title: e.title,
    description: e.description,
    documentId: e.documentId,
    documentTitle: e.document?.title ?? null,
  }));

  const serializedDocuments = documents.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
  }));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Timeline zdrowia</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Chronologiczny przegląd wydarzeń zdrowotnych
            </p>
          </div>
        </div>
        <Link
          href="/health/documents"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline mt-1.5"
        >
          Biblioteka badań →
        </Link>
      </div>

      <TimelineManager
        events={serializedEvents}
        documents={serializedDocuments}
      />
    </div>
  );
}
