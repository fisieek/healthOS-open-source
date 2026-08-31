import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }

    const { id } = await props.params;
    const userId = session.user.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: "Nie znaleziono konwersacji" }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error: any) {
    console.error("Błąd pobierania szczegółów konwersacji:", error);
    return NextResponse.json({ error: error.message || "Błąd wewnętrzny serwera" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 });
    }

    const { id } = await props.params;
    const userId = session.user.id;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation || conversation.userId !== userId) {
      return NextResponse.json({ error: "Nie znaleziono konwersacji" }, { status: 404 });
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Błąd usuwania konwersacji:", error);
    return NextResponse.json({ error: error.message || "Błąd wewnętrzny serwera" }, { status: 500 });
  }
}
