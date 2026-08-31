/**
 * /api/settings/biomarkers
 *
 * Zarządzanie słownikiem biomarkerów użytkownika.
 * Biomarkery są przechowywane w tabeli HealthDocument.parameters jako JSON
 * lub w dedykowanej tabeli — tutaj używamy prostego podejścia z UserProfile.settings JSON.
 *
 * Ponieważ nie mamy dedykowanej tabeli biomarkerów, przechowujemy je
 * w polu `settings` modelu UserProfile jako JSON array.
 */

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DEFAULT_BIOMARKERS, BiomarkerEntry, mergeBiomarkersWithDefaults, getDefaultBiomarkersWithIds } from "@/lib/constants/biomarkers";

async function getBiomarkers(userId: string): Promise<BiomarkerEntry[]> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { settings: true },
  });
  const s = (profile?.settings as any) ?? {};
  
  const defaultWithIds = getDefaultBiomarkersWithIds();

  if (!s.biomarkers || !Array.isArray(s.biomarkers) || s.biomarkers.length === 0) {
    await prisma.userProfile.upsert({
      where: { userId },
      update: { settings: { ...s, biomarkers: defaultWithIds } as any },
      create: { userId, settings: { biomarkers: defaultWithIds } as any },
    });
    return defaultWithIds;
  }

  // Bezpieczny merge: dodaje brakujące pozycje I uzupełnia brakujące pola
  // (np. nowo wprowadzony qualitativeNorm) bez nadpisywania wartości użytkownika.
  const existing = s.biomarkers as (BiomarkerEntry & { id: string })[];
  const { merged, changed } = mergeBiomarkersWithDefaults(existing, defaultWithIds);

  if (changed) {
    await prisma.userProfile.update({
      where: { userId },
      data: { settings: { ...s, biomarkers: merged } as any },
    });
  }
  return merged;
}

async function saveBiomarkers(userId: string, biomarkers: BiomarkerEntry[]) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { settings: true },
  });
  const existing = (profile?.settings as any) ?? {};
  await prisma.userProfile.upsert({
    where: { userId },
    update: { settings: { ...existing, biomarkers } as any },
    create: { userId, settings: { biomarkers } as any },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const biomarkers = await getBiomarkers(session.user.id);
  return Response.json(biomarkers);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, unit, normMin, normMax, category } = body;
  if (!name || !unit) return Response.json({ error: "name and unit required" }, { status: 400 });

  const biomarkers = await getBiomarkers(session.user.id);
  const newEntry: BiomarkerEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    name,
    unit,
    normMin: normMin != null ? parseFloat(normMin) : null,
    normMax: normMax != null ? parseFloat(normMax) : null,
    category: category ?? "Inne",
  };
  biomarkers.push(newEntry);
  await saveBiomarkers(session.user.id, biomarkers);
  return Response.json(newEntry, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const biomarkers = await getBiomarkers(session.user.id);
  const filtered = biomarkers.filter(b => b.id !== id);
  await saveBiomarkers(session.user.id, filtered);
  return Response.json({ ok: true });
}
