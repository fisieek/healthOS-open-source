import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { subMonths } from "date-fns";
import { getAllNutrients, convertAmount } from "@/lib/services/nutrients";

export const getBloodTestResults = (userId: string) => tool({
  description: "Pobiera wyniki badań krwi (i badań hormonalnych) użytkownika z ostatnich N miesięcy (np. parametry, wartości, jednostki, normy).",
  inputSchema: z.object({
    months: z.number().describe("Liczba miesięcy wstecz do pobrania badań (np. 6, 12, 24)").optional().default(12),
  }),
  execute: async ({ months }: any) => {
    try {
      const limitDate = subMonths(new Date(), months);
      const data = await prisma.healthDocument.findMany({
        where: {
          userId,
          type: { in: ["BLOOD_TEST", "HORMONES", "HORMONES_TEST"] },
          studyDate: { gte: limitDate },
        },
        orderBy: { studyDate: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania wyników badań." };
    }
  },
});

export const getBloodTestTrend = (userId: string) => tool({
  description: "Pobiera historyczny trend zmian (wartości w czasie) dla konkretnego parametru z badań krwi (np. LDL, TSH, Żelazo, Ferrytyna).",
  inputSchema: z.object({
    parameterName: z.string().describe("Nazwa parametru do prześledzenia (np. 'LDL', 'TSH', 'Ferrytyna')"),
  }),
  execute: async ({ parameterName }: any) => {
    try {
      const docs = await prisma.healthDocument.findMany({
        where: {
          userId,
          type: { in: ["BLOOD_TEST", "HORMONES", "HORMONES_TEST"] },
        },
        orderBy: { studyDate: "asc" },
      });

      const trend: Array<{ date: Date; title: string; value: number; unit: string; min?: number; max?: number }> = [];
      const searchKey = parameterName.toLowerCase().trim();

      for (const doc of docs) {
        if (doc.parameters && typeof doc.parameters === "object") {
          const params = doc.parameters as Record<string, any>;
          // Szukamy pasującego klucza (dokładnie lub jako podtekst)
          const matchedKey = Object.keys(params).find(k => k.toLowerCase().includes(searchKey));
          if (matchedKey) {
            const entry = params[matchedKey];
            if (entry && typeof entry === "object" && entry.value !== undefined) {
              trend.push({
                date: doc.studyDate,
                title: doc.title,
                value: Number(entry.value),
                unit: entry.unit || "",
                min: entry.min !== undefined ? Number(entry.min) : undefined,
                max: entry.max !== undefined ? Number(entry.max) : undefined,
              });
            } else if (typeof entry === "number" || typeof entry === "string") {
              const val = Number(entry);
              if (!isNaN(val)) {
                trend.push({
                  date: doc.studyDate,
                  title: doc.title,
                  value: val,
                  unit: "",
                });
              }
            }
          }
        }
      }

      return { parameter: parameterName, trend };
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania trendu parametru." };
    }
  },
});

export const getMedications = (userId: string) => tool({
  description: "Pobiera listę leków przyjmowanych przez użytkownika (aktualnych i opcjonalnie zakończonych).",
  inputSchema: z.object({
    includeEnded: z.boolean().describe("Czy uwzględnić leki, których przyjmowanie zostało już zakończone").optional().default(false),
  }),
  execute: async ({ includeEnded }: any) => {
    try {
      const now = new Date();
      const whereClause: any = { userId };
      if (!includeEnded) {
        whereClause.startDate = { lte: now };
        whereClause.OR = [
          { endDate: null },
          { endDate: { gte: now } },
        ];
      }
      const data = await prisma.medication.findMany({
        where: whereClause,
        orderBy: { startDate: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania listy leków." };
    }
  },
});

export const getSupplements = (userId: string) => tool({
  description: "Pobiera listę suplementów diety (aktualnych i opcjonalnie zakończonych) wraz z ich składnikami aktywnymi.",
  inputSchema: z.object({
    includeEnded: z.boolean().describe("Czy uwzględnić suplementy, których suplementacja została zakończona").optional().default(false),
  }),
  execute: async ({ includeEnded }: any) => {
    try {
      const now = new Date();
      const whereClause: any = { userId };
      if (!includeEnded) {
        whereClause.startDate = { lte: now };
        whereClause.OR = [
          { endDate: null },
          { endDate: { gte: now } },
        ];
      }
      const data = await prisma.supplement.findMany({
        where: whereClause,
        include: {
          ingredients: true,
        },
        orderBy: { startDate: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania suplementów." };
    }
  },
});

export const getSupplementDailySummary = (userId: string) => tool({
  description: "Pobiera dzisiejsze spożycie witamin i minerałów z przyjętych suplementów i porównuje je z zalecanym dziennym spożyciem (RDA/UL).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const intakes = await prisma.supplementIntake.findMany({
        where: {
          userId,
          takenAt: { gte: startOfDay, lte: endOfDay },
        },
        include: {
          supplement: {
            include: {
              ingredients: true,
            },
          },
        },
      });

      const nutrients = await getAllNutrients();
      const dailyTotals: Record<string, { name: string; amount: number; unit: string; rda: number | null; upperLimit: number | null }> = {};

      for (const intake of intakes) {
        const portion = intake.portion || 1.0;
        const ingredients = intake.supplement.ingredients;

        for (const ing of ingredients) {
          if (!ing.amount) continue;

          // Próbujemy dopasować do kanonicznego Nutrient
          const matched = nutrients.find(n => n.id === ing.nutrientId || n.name.toLowerCase() === ing.name.toLowerCase());
          const targetUnit = matched?.defaultUnit || ing.unit || "mg";
          const converted = convertAmount(ing.amount * portion, ing.unit, targetUnit, matched?.slug);

          if (converted !== null) {
            const key = matched?.id || ing.name.toLowerCase();
            if (!dailyTotals[key]) {
              dailyTotals[key] = {
                name: matched?.name || ing.name,
                amount: 0,
                unit: targetUnit,
                rda: matched?.rda ?? null,
                upperLimit: matched?.upperLimit ?? null,
              };
            }
            dailyTotals[key].amount += converted;
          }
        }
      }

      return Object.values(dailyTotals);
    } catch (error: any) {
      return { error: error.message || "Błąd podczas generowania podsumowania suplementacji." };
    }
  },
});

export const getMedicalVisits = (userId: string) => tool({
  description: "Pobiera historię wizyt lekarskich użytkownika z ostatnich N miesięcy (specjaliści, diagnozy, zalecenia, daty kontroli).",
  inputSchema: z.object({
    months: z.number().describe("Liczba miesięcy wstecz (np. 12)").optional().default(12),
  }),
  execute: async ({ months }: any) => {
    try {
      const limitDate = subMonths(new Date(), months);
      const data = await prisma.medicalVisit.findMany({
        where: {
          userId,
          date: { gte: limitDate },
        },
        orderBy: { date: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania wizyt medycznych." };
    }
  },
});

export const getHealthTimeline = (userId: string) => tool({
  description: "Pobiera oś czasu zdarzeń zdrowotnych (choroby, kontuzje, szczepienia, początki leczenia, ważne notatki medyczne) z ostatnich N miesięcy.",
  inputSchema: z.object({
    months: z.number().describe("Liczba miesięcy wstecz").optional().default(6),
  }),
  execute: async ({ months }: any) => {
    try {
      const limitDate = subMonths(new Date(), months);
      const data = await prisma.healthEvent.findMany({
        where: {
          userId,
          date: { gte: limitDate },
        },
        orderBy: { date: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania osi czasu zdrowia." };
    }
  },
});

export const getReferrals = (userId: string) => tool({
  description: "Pobiera listę skierowań lekarskich użytkownika (kod dostępu, wystawca, specjalizacja, ważność).",
  inputSchema: z.object({
    activeOnly: z.boolean().describe("Czy pobrać tylko niewykorzystane skierowania").optional().default(true),
  }),
  execute: async ({ activeOnly }: any) => {
    try {
      const now = new Date();
      const whereClause: any = { userId };
      if (activeOnly) {
        whereClause.isUsed = false;
        whereClause.OR = [
          { expiryDate: null },
          { expiryDate: { gte: now } },
        ];
      }
      const data = await prisma.referral.findMany({
        where: whereClause,
        orderBy: { issueDate: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania skierowań." };
    }
  },
});

export const getImagingReports = (userId: string) => tool({
  description: "Pobiera raporty z badań obrazowych (RTG, rezonans MRI, USG, tomografia TK) z ostatnich N miesięcy.",
  inputSchema: z.object({
    months: z.number().describe("Liczba miesięcy wstecz").optional().default(12),
  }),
  execute: async ({ months }: any) => {
    try {
      const limitDate = subMonths(new Date(), months);
      const data = await prisma.healthDocument.findMany({
        where: {
          userId,
          type: "IMAGING",
          studyDate: { gte: limitDate },
        },
        orderBy: { studyDate: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania wyników badań obrazowych." };
    }
  },
});

export const getDentalRecords = (userId: string) => tool({
  description: "Pobiera historię stomatologiczną użytkownika (leczenie zębów, przeglądy, higienizacje).",
  inputSchema: z.object({
    count: z.number().describe("Maksymalna liczba rekordów do pobrania").optional().default(10),
  }),
  execute: async ({ count }: any) => {
    try {
      const data = await prisma.dentalRecord.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: count,
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Błąd podczas pobierania historii dentystycznej." };
    }
  },
});
