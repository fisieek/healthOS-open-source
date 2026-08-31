import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SessionProvider } from "next-auth/react";
import { AppNav } from "@/components/app-nav";
import { AppHeader } from "@/components/app-header";
import { auth } from "@/auth";

// Lokalna apka desktopowa — używamy systemowych fontów (na macOS: San Francisco).
// Nie ładujemy fontów z Google żeby aplikacja działała offline.

export const metadata: Metadata = {
  title: "Health OS",
  description: "Personal health and training dashboard",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <html lang="pl" className={cn("font-sans dark")} suppressHydrationWarning>
      <body className="bg-[#0d0e0c] text-white antialiased" suppressHydrationWarning>
        <SessionProvider session={session}>
          {isLoggedIn ? (
            <div className="flex h-screen overflow-hidden bg-[#0d0e0c]">
              <aside className="w-64 shrink-0 flex flex-col h-full">
                <AppNav />
              </aside>
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <AppHeader />
                <main className="flex-1 overflow-y-auto bg-[#0d0e0c] px-8 py-6">
                  {children}
                </main>
              </div>
            </div>
          ) : (
            children
          )}
        </SessionProvider>
      </body>
    </html>
  );
}

