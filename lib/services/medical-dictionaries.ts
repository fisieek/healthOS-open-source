import { prisma } from "@/lib/db";

/**
 * Słowniki medyczne per-user: Lekarz / Placówka / Powód-Część ciała.
 *
 * `resolve*` = find-or-create: przy zapisie wizyty/badania nowa nazwa
 * automatycznie trafia do słownika (unikalność po [userId, name]).
 */

export type DictionaryKind = "doctors" | "facilities" | "body-parts";

/**
 * Dopasowanie nazwy do istniejącego wpisu słownika **ignorując wielkość liter**.
 *
 * Unikalność w bazie jest po `[userId, name]` i SQLite porównuje TEXT binarnie,
 * więc bez tego „Tarczyca" i „tarczyca" to dwa osobne wpisy. Realny przypadek:
 * ekstrakcja AI zwraca nazwę części ciała w mianowniku małą literą i zakłada
 * duplikat obok wpisu utworzonego wcześniej ręcznie.
 *
 * Diakrytyków celowo NIE składamy — „Sledziona" i „Śledziona" zostają osobne,
 * bo to już zgadywanie intencji użytkownika.
 */
function matchesName(candidate: string, target: string): boolean {
  return (
    candidate.trim().toLocaleLowerCase("pl") === target.trim().toLocaleLowerCase("pl")
  );
}

// ─── Resolve-or-create (używane przy zapisie wizyt i badań) ─────────────────────

export async function resolveDoctorId(
  userId: string,
  name?: string | null,
  specialization?: string | null
): Promise<string | null> {
  const n = (name ?? "").trim();
  if (!n) return null;
  const spec = (specialization ?? "").trim() || null;

  // Słowniki są per-user i małe (kilkanaście–kilkadziesiąt pozycji), więc
  // porównanie w pamięci jest tańsze niż raw SQL z LOWER().
  const existing = await prisma.medicalDoctor.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const hit = existing.find((e) => matchesName(e.name, n));
  if (hit) {
    if (spec) {
      await prisma.medicalDoctor.update({
        where: { id: hit.id },
        data: { specialization: spec },
      });
    }
    return hit.id;
  }

  const row = await prisma.medicalDoctor.upsert({
    where: { userId_name: { userId, name: n } },
    update: spec ? { specialization: spec } : {},
    create: { userId, name: n, specialization: spec },
    select: { id: true },
  });
  return row.id;
}

export async function resolveFacilityId(
  userId: string,
  name?: string | null
): Promise<string | null> {
  const n = (name ?? "").trim();
  if (!n) return null;

  const existing = await prisma.medicalFacility.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const hit = existing.find((e) => matchesName(e.name, n));
  if (hit) return hit.id;

  const row = await prisma.medicalFacility.upsert({
    where: { userId_name: { userId, name: n } },
    update: {},
    create: { userId, name: n },
    select: { id: true },
  });
  return row.id;
}

export async function resolveBodyPartId(
  userId: string,
  name?: string | null
): Promise<string | null> {
  const n = (name ?? "").trim();
  if (!n) return null;

  const existing = await prisma.bodyPart.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const hit = existing.find((e) => matchesName(e.name, n));
  if (hit) return hit.id;

  const row = await prisma.bodyPart.upsert({
    where: { userId_name: { userId, name: n } },
    update: {},
    create: { userId, name: n },
    select: { id: true },
  });
  return row.id;
}

// ─── Listowanie (do formularzy / datalist / ekranu zarządzania) ─────────────────

export async function listDictionaries(userId: string) {
  const [doctors, facilities, bodyParts, episodes, visits] = await Promise.all([
    prisma.medicalDoctor.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, specialization: true },
    }),
    prisma.medicalFacility.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      // `address` zasila „miejsce" zdarzenia w Kalendarzu Google (poz. 9 etap 4).
      select: { id: true, name: true, address: true },
    }),
    prisma.bodyPart.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, notes: true },
    }),
    // Epizody leczenia — potrzebne formularzom wizyt i badań (select „Leczenie").
    prisma.careEpisode.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      select: {
        id: true,
        bodyPartId: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    }),
    // Wizyty — potrzebne `ExamFormModal` do listy „Podepnij do wizyty".
    // Modal filtruje je sam (po epizodzie / części ciała), więc oddajemy komplet.
    prisma.medicalVisit.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        date: true,
        plannedDate: true,
        status: true,
        doctorName: true,
        specialization: true,
        bodyPartId: true,
        episodeId: true,
      },
    }),
  ]);
  return { doctors, facilities, bodyParts, episodes, visits };
}

// ─── Zarządzanie wpisami (rename / merge / delete) ──────────────────────────────

/** Zwraca liczbę wizyt i badań korzystających z danego wpisu słownika. */
export async function usageCount(
  kind: DictionaryKind,
  userId: string,
  id: string
): Promise<number> {
  if (kind === "doctors") {
    const [v, ordered, performed] = await Promise.all([
      prisma.medicalVisit.count({ where: { userId, doctorId: id } }),
      prisma.healthDocument.count({ where: { userId, orderingDoctorId: id } }),
      prisma.healthDocument.count({ where: { userId, performingDoctorId: id } }),
    ]);
    return v + ordered + performed;
  }
  if (kind === "facilities") {
    const [v, d] = await Promise.all([
      prisma.medicalVisit.count({ where: { userId, facilityId: id } }),
      prisma.healthDocument.count({ where: { userId, facilityId: id } }),
    ]);
    return v + d;
  }
  // body-parts
  const [v, d] = await Promise.all([
    prisma.medicalVisit.count({ where: { userId, bodyPartId: id } }),
    prisma.healthDocument.count({ where: { userId, bodyPartId: id } }),
  ]);
  return v + d;
}

/** Sprawdza własność wpisu; zwraca true jeśli należy do usera. */
export async function ownsEntry(
  kind: DictionaryKind,
  userId: string,
  id: string
): Promise<boolean> {
  const where = { id, userId };
  const found =
    kind === "doctors"
      ? await prisma.medicalDoctor.findFirst({ where, select: { id: true } })
      : kind === "facilities"
      ? await prisma.medicalFacility.findFirst({ where, select: { id: true } })
      : await prisma.bodyPart.findFirst({ where, select: { id: true } });
  return !!found;
}

export async function renameEntry(
  kind: DictionaryKind,
  userId: string,
  id: string,
  data: {
    name?: string;
    specialization?: string | null;
    notes?: string | null;
    address?: string | null;
  }
) {
  const name = data.name?.trim();
  if (kind === "doctors") {
    return prisma.medicalDoctor.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(data.specialization !== undefined
          ? { specialization: data.specialization?.trim() || null }
          : {}),
      },
    });
  }
  if (kind === "facilities") {
    return prisma.medicalFacility.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(data.address !== undefined
          ? { address: data.address?.trim() || null }
          : {}),
      },
    });
  }
  return prisma.bodyPart.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
    },
  });
}

/** Usuwa wpis. FK są SET NULL, więc powiązane wizyty/badania nie znikają. */
export async function deleteEntry(
  kind: DictionaryKind,
  id: string
): Promise<void> {
  if (kind === "doctors") await prisma.medicalDoctor.delete({ where: { id } });
  else if (kind === "facilities") await prisma.medicalFacility.delete({ where: { id } });
  else await prisma.bodyPart.delete({ where: { id } });
}

/**
 * Scala wpis źródłowy (fromId) w docelowy (toId): przepina wszystkie FK,
 * po czym usuwa źródłowy. Wszystko w jednej transakcji.
 */
export async function mergeEntries(
  kind: DictionaryKind,
  userId: string,
  fromId: string,
  toId: string
): Promise<void> {
  if (fromId === toId) return;

  await prisma.$transaction(async (tx) => {
    if (kind === "doctors") {
      await tx.medicalVisit.updateMany({
        where: { userId, doctorId: fromId },
        data: { doctorId: toId },
      });
      await tx.healthDocument.updateMany({
        where: { userId, orderingDoctorId: fromId },
        data: { orderingDoctorId: toId },
      });
      await tx.healthDocument.updateMany({
        where: { userId, performingDoctorId: fromId },
        data: { performingDoctorId: toId },
      });
      await tx.medicalDoctor.delete({ where: { id: fromId } });
    } else if (kind === "facilities") {
      await tx.medicalVisit.updateMany({
        where: { userId, facilityId: fromId },
        data: { facilityId: toId },
      });
      await tx.healthDocument.updateMany({
        where: { userId, facilityId: fromId },
        data: { facilityId: toId },
      });
      await tx.medicalFacility.delete({ where: { id: fromId } });
    } else {
      await tx.medicalVisit.updateMany({
        where: { userId, bodyPartId: fromId },
        data: { bodyPartId: toId },
      });
      await tx.healthDocument.updateMany({
        where: { userId, bodyPartId: fromId },
        data: { bodyPartId: toId },
      });
      await tx.bodyPart.delete({ where: { id: fromId } });
    }
  });
}

/** Tworzy wpis słownika bez powiązania (ręczne dodanie z ekranu zarządzania). */
export async function createEntry(
  kind: DictionaryKind,
  userId: string,
  data: { name: string; specialization?: string | null; notes?: string | null }
) {
  const name = data.name.trim();
  if (!name) throw new Error("name required");

  // Ten sam niezmiennik co w `resolve*`: nie zakładamy drugiego wpisu, który
  // różni się wyłącznie wielkością liter.
  const existing =
    kind === "doctors"
      ? await prisma.medicalDoctor.findMany({ where: { userId }, select: { id: true, name: true } })
      : kind === "facilities"
      ? await prisma.medicalFacility.findMany({ where: { userId }, select: { id: true, name: true } })
      : await prisma.bodyPart.findMany({ where: { userId }, select: { id: true, name: true } });
  const hit = existing.find((e) => matchesName(e.name, name));
  if (hit) {
    // Zwracamy istniejący wpis pod jego oryginalną nazwą — bez nadpisywania.
    if (kind === "doctors") return prisma.medicalDoctor.findUniqueOrThrow({ where: { id: hit.id } });
    if (kind === "facilities") return prisma.medicalFacility.findUniqueOrThrow({ where: { id: hit.id } });
    return prisma.bodyPart.findUniqueOrThrow({ where: { id: hit.id } });
  }

  if (kind === "doctors") {
    return prisma.medicalDoctor.upsert({
      where: { userId_name: { userId, name } },
      update: data.specialization ? { specialization: data.specialization.trim() } : {},
      create: { userId, name, specialization: data.specialization?.trim() || null },
    });
  }
  if (kind === "facilities") {
    return prisma.medicalFacility.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });
  }
  return prisma.bodyPart.upsert({
    where: { userId_name: { userId, name } },
    update: data.notes ? { notes: data.notes.trim() } : {},
    create: { userId, name, notes: data.notes?.trim() || null },
  });
}
