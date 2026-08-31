import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AsystentClient } from "./asystent-client";

export default async function AsystentPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  // Sprawdzamy czy klucz Gemini jest skonfigurowany w zmiennych środowiskowych lub w profilu użytkownika
  let hasGeminiKey = !!process.env.GEMINI_API_KEY;
  if (!hasGeminiKey) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { settings: true },
    });
    if (profile?.settings) {
      const settings = profile.settings as Record<string, any>;
      if (settings.geminiApiKey && typeof settings.geminiApiKey === "string" && settings.geminiApiKey.trim()) {
        hasGeminiKey = true;
      }
    }
  }

  return <AsystentClient hasGeminiKey={hasGeminiKey} />;
}
