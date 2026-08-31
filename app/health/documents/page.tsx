import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { FileText } from "lucide-react";
import { DocumentsManager } from "./documents-manager";
import Link from "next/link";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const documents = await prisma.healthDocument.findMany({
    where: { userId },
    orderBy: { studyDate: "desc" },
  });

  const serialized = documents.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    studyDate: d.studyDate.toISOString(),
    laboratory: d.laboratory,
    doctor: d.doctor,
    description: d.description,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    fileUrl: d.fileUrl,
    parameters: d.parameters as Record<string, { value: string; unit?: string }> | null,
  }));

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Biblioteka badań</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Archiwum dokumentów medycznych i wyników badań
            </p>
          </div>
        </div>
        <Link
          href="/health/timeline"
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline mt-1.5"
        >
          ← Timeline zdrowia
        </Link>
      </div>

      <DocumentsManager documents={serialized} />
    </div>
  );
}
