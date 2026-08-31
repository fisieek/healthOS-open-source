import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { subDays } from "date-fns";

export const getSleepData = (userId: string) => tool({
  description: "Pobiera dane o sesjach snu użytkownika z ostatnich N dni (daty, czas trwania, fazy snu, efektywność).",
  inputSchema: z.object({
    days: z.number().describe("Liczba ostatnich dni, z których mają być pobrane dane snu (np. 7, 14, 30)").optional().default(7),
  }),
  execute: async ({ days }: any) => {
    try {
      const limitDate = subDays(new Date(), days);
      const data = await prisma.sleepSession.findMany({
        where: {
          userId,
          date: { gte: limitDate },
        },
        orderBy: { date: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Wystąpił błąd podczas pobierania danych snu." };
    }
  },
});

export const getDailyMetrics = (userId: string) => tool({
  description: "Pobiera całodzienne wskaźniki zdrowotne (kroki, kalorie, tętno spoczynkowe RHR, HRV, saturacja SpO2, stres) z ostatnich N dni.",
  inputSchema: z.object({
    days: z.number().describe("Liczba ostatnich dni do pobrania metryk (np. 7, 30)").optional().default(7),
  }),
  execute: async ({ days }: any) => {
    try {
      const limitDate = subDays(new Date(), days);
      const data = await prisma.dailyMetric.findMany({
        where: {
          userId,
          date: { gte: limitDate },
        },
        orderBy: { date: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Wystąpił błąd podczas pobierania metryk dziennych." };
    }
  },
});

export const getBodyComposition = (userId: string) => tool({
  description: "Pobiera historię ostatnich N pomiarów składu ciała i wagi (waga, BMI, % tkanki tłuszczowej, masa mięśniowa, woda, wiek metaboliczny).",
  inputSchema: z.object({
    count: z.number().describe("Liczba ostatnich wpisów do pobrania (np. 5, 10)").optional().default(5),
  }),
  execute: async ({ count }: any) => {
    try {
      const data = await prisma.bodyMeasurement.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: count,
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Wystąpił błąd podczas pobierania pomiarów ciała." };
    }
  },
});

export const getWellnessEntries = (userId: string) => tool({
  description: "Pobiera dane o samopoczuciu psychicznym i fizycznym (energia, nastrój, stres odczuwalny) z ostatnich N dni.",
  inputSchema: z.object({
    days: z.number().describe("Liczba ostatnich dni do pobrania samopoczucia").optional().default(14),
  }),
  execute: async ({ days }: any) => {
    try {
      const limitDate = subDays(new Date(), days);
      const data = await prisma.wellnessEntry.findMany({
        where: {
          userId,
          date: { gte: limitDate },
        },
        orderBy: { date: "desc" },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Wystąpił błąd podczas pobierania danych o samopoczuciu." };
    }
  },
});

export const getUserProfile = (userId: string) => tool({
  description: "Pobiera szczegółowe parametry profilu fizjologicznego i treningowego użytkownika (wiek, płeć, wzrost, strefy tętna maxHr/restingHr/lthr, FTP, VDOT).",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const data = await prisma.userProfile.findUnique({
        where: { userId },
      });
      return data;
    } catch (error: any) {
      return { error: error.message || "Wystąpił błąd podczas pobierania profilu." };
    }
  },
});
