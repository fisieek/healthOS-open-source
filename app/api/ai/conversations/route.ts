import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { AgentType } from "@/app/generated/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const agentTypeParam = searchParams.get("agentType");

    if (agentTypeParam && agentTypeParam !== "DOCTOR" && agentTypeParam !== "TRAINER") {
      return NextResponse.json({ error: "Nieprawidłowy agentType" }, { status: 400 });
    }

    const whereClause: any = { userId };
    if (agentTypeParam) {
      whereClause.agentType = agentTypeParam as AgentType;
    }

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const formatted = conversations.map(c => ({
      id: c.id,
      title: c.title || "Rozmowa bez tytułu",
      agentType: c.agentType,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastMessage: c.messages[0] ? {
        content: c.messages[0].content,
        createdAt: c.messages[0].createdAt,
        role: c.messages[0].role
      } : null
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("Błąd pobierania konwersacji:", error);
    return NextResponse.json({ error: error.message || "Błąd wewnętrzny serwera" }, { status: 500 });
  }
}
