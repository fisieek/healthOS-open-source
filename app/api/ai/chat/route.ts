import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { convertToModelMessages, streamText, generateText, stepCountIs } from "ai";
import { getGoogleProvider } from "@/lib/ai/provider";
import { buildUserContext } from "@/lib/ai/context";
import { getDoctorSystemPrompt } from "@/lib/ai/prompts/doctor";
import { getTrainerSystemPrompt } from "@/lib/ai/prompts/trainer";

// Import shared tools
import {
  getSleepData,
  getDailyMetrics,
  getBodyComposition,
  getWellnessEntries,
  getUserProfile
} from "@/lib/ai/tools/shared";

// Import doctor tools
import {
  getBloodTestResults,
  getBloodTestTrend,
  getMedications,
  getSupplements,
  getSupplementDailySummary,
  getMedicalVisits,
  getHealthTimeline,
  getReferrals,
  getImagingReports,
  getDentalRecords
} from "@/lib/ai/tools/doctor-tools";

// Import trainer tools
import {
  getRecentActivities,
  getRecentStrengthWorkouts,
  getTrainingLoad,
  getRunningStats,
  getPersonalBestsRuns,
  getPersonalBestsLifts,
  getTrainingPlan,
  getHrZonesConfig,
  getActivityDetails,
  getStrengthExerciseProgress
} from "@/lib/ai/tools/trainer-tools";

function getMessageContent(message: any): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part: any) => {
        if (part.type === "text") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }

    const userId = session.user.id;
    const { messages, agentType, conversationId } = await request.json();

    if (!agentType || (agentType !== "DOCTOR" && agentType !== "TRAINER")) {
      return NextResponse.json({ error: "Nieprawidłowy agentType" }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Brak wiadomości" }, { status: 400 });
    }

    // 1. Resolve or create Conversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation || conversation.userId !== userId) {
        return NextResponse.json({ error: "Konwersacja nie istnieje lub brak dostępu" }, { status: 404 });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId,
          agentType,
          title: "Nowa konwersacja",
        },
      });
    }

    // 2. Save last User Message to database
    const lastUserMsg = messages[messages.length - 1];
    const lastUserMsgText = getMessageContent(lastUserMsg);
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: lastUserMsg.role,
        content: lastUserMsgText,
      },
    });

    // 3. Resolve API provider and build user context
    const googleProvider = await getGoogleProvider(userId);
    const userContext = await buildUserContext(userId);

    // 4. Select prompt
    const system = agentType === "DOCTOR"
      ? getDoctorSystemPrompt(userContext)
      : getTrainerSystemPrompt(userContext);

    // 5. Gather tools
    const sharedTools = {
      getSleepData: getSleepData(userId),
      getDailyMetrics: getDailyMetrics(userId),
      getBodyComposition: getBodyComposition(userId),
      getWellnessEntries: getWellnessEntries(userId),
      getUserProfile: getUserProfile(userId),
    };

    const tools = agentType === "DOCTOR"
      ? {
          ...sharedTools,
          getBloodTestResults: getBloodTestResults(userId),
          getBloodTestTrend: getBloodTestTrend(userId),
          getMedications: getMedications(userId),
          getSupplements: getSupplements(userId),
          getSupplementDailySummary: getSupplementDailySummary(userId),
          getMedicalVisits: getMedicalVisits(userId),
          getHealthTimeline: getHealthTimeline(userId),
          getReferrals: getReferrals(userId),
          getImagingReports: getImagingReports(userId),
          getDentalRecords: getDentalRecords(userId),
        }
      : {
          ...sharedTools,
          getRecentActivities: getRecentActivities(userId),
          getRecentStrengthWorkouts: getRecentStrengthWorkouts(userId),
          getTrainingLoad: getTrainingLoad(userId),
          getRunningStats: getRunningStats(userId),
          getPersonalBestsRuns: getPersonalBestsRuns(userId),
          getPersonalBestsLifts: getPersonalBestsLifts(userId),
          getTrainingPlan: getTrainingPlan(userId),
          getHrZonesConfig: getHrZonesConfig(userId),
          getActivityDetails: getActivityDetails(userId),
          getStrengthExerciseProgress: getStrengthExerciseProgress(userId),
        };

    const coreMessages = messages
      .map((msg: any) => {
        let text = "";
        if (typeof msg.content === "string") {
          text = msg.content;
        } else if (Array.isArray(msg.parts)) {
          text = msg.parts
            .map((part: any) => (part.type === "text" ? part.text : ""))
            .filter(Boolean)
            .join("\n");
        }
        return {
          role: msg.role,
          content: text,
        };
      })
      .filter((msg: any) => msg.content.trim() !== "");

    // 6. Run streamText
    const result = streamText({
      model: googleProvider("gemini-3.5-flash") as any,
      system,
      messages: coreMessages,
      tools: tools as any,
      stopWhen: stepCountIs(5),
      onFinish: async (response: any) => {
        // Save Assistant Message to database
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: response.text,
          },
        });

        // Trigger Conversation Title update if it's the first exchange
        const messageCount = await prisma.message.count({
          where: { conversationId: conversation.id },
        });

        if (messageCount <= 2) {
          try {
            const titleResult = await generateText({
              model: googleProvider("gemini-3.5-flash") as any,
              prompt: `Na podstawie pierwszej wiadomości użytkownika, wygeneruj KRÓTKI, zwięzły tytuł konwersacji (maksymalnie 6 słów, w języku polskim). Wiadomość: "${lastUserMsgText}". Zwróć TYLKO tytuł, bez cudzysłowów, znaków zapytania i dodatkowych uwag.`,
            } as any);
            const generatedTitle = titleResult.text.trim().replace(/^"(.*)"$/, '$1');
            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { title: generatedTitle || "Czat asystenta" },
            });
          } catch (err) {
            console.error("Błąd generowania tytułu konwersacji:", err);
          }
        }
      },
    } as any);

    return (result as any).toUIMessageStreamResponse({
      headers: {
        "x-conversation-id": conversation.id,
      },
    });
  } catch (error: any) {
    console.error("Błąd w API czatu AI:", error);
    return NextResponse.json({ error: error.message || "Wystąpił błąd serwera" }, { status: 500 });
  }
}
