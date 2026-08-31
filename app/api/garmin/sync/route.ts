import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { DataSourceType } from "@/app/generated/prisma/client";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Find Garmin data source
  const source = await prisma.dataSource.findUnique({
    where: { userId_type: { userId, type: DataSourceType.GARMIN } },
  });

  if (!source || !source.isActive) {
    return Response.json(
      { error: "Garmin Connect nie jest skonfigurowany lub włączony", code: "NOT_CONFIGURED" },
      { status: 412 }
    );
  }

  const settings = (source.settings ?? {}) as Record<string, any>;
  const email = settings.email;
  const password = settings.password;

  if (!email || !password) {
    return Response.json(
      { error: "Brak loginu lub hasła Garmin Connect w ustawieniach", code: "MISSING_CREDENTIALS" },
      { status: 412 }
    );
  }

  // Token, którym skrypt przedstawia się endpointowi /api/garmin/ingest.
  // Sprawdzany TU, przed założeniem wpisu w SyncLog — inaczej zostawialibyśmy
  // po sobie wpis "running", który nigdy się nie domknie.
  const secret = process.env.GARMIN_INGEST_SECRET;
  if (!secret) {
    return Response.json(
      {
        error:
          "Brak GARMIN_INGEST_SECRET w konfiguracji. Wygeneruj go poleceniem " +
          "`openssl rand -base64 32` i wpisz do .env.local.",
        code: "MISSING_INGEST_SECRET",
      },
      { status: 412 }
    );
  }

  // Determine current host and port
  const host = request.headers.get("host") || "localhost:3000";
  const appUrl = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? `http://${host}`
    : `https://${host}`;

  // Log sync trigger start
  const startedAt = new Date();
  const syncLog = await prisma.syncLog.create({
    data: {
      userId,
      dataSourceId: source.id,
      triggeredBy: "manual",
      status: "running",
      startedAt,
    },
  });

  // Execute sync script in Python
  // scripts/sync_garmin.py
  // using .venv/bin/python or python3 (on macOS/Linux it should be scripts/.venv/bin/python)
  const rootDir = process.cwd();
  
  // Construct paths dynamically to bypass Turbopack static file-tracing bugs on venv symlinks
  const pythonCmd = [rootDir, "scripts", ".venv", "bin", "python"].join(path.sep);
  const scriptPath = [rootDir, "scripts", "sync_garmin.py"].join(path.sep);

  return new Promise<Response>((resolve) => {
    console.log(`Starting Garmin Sync: ${pythonCmd} ${scriptPath}`);
    
    // Spawn python process
    const pyProcess = spawn(
      pythonCmd,
      [
        scriptPath,
        "--email", email,
        "--user-id", userId,
        "--app-url", appUrl,
        "--days", "3", // Sync last 3 days
        "--stdin-secrets",
      ],
      {
        cwd: rootDir,
        env: { ...process.env }
      }
    );

    // Hasło do Garmin Connect i token ingest NIE mogą iść argumentami:
    // argumenty uruchomionego procesu widzi w macOS każdy inny program
    // działający na tym koncie (`ps aux`). Strumień wejściowy jest prywatny
    // dla pary rodzic–dziecko, więc przekazujemy je tędy.
    pyProcess.stdin.write(JSON.stringify({ password, secret }) + "\n");
    pyProcess.stdin.end();

    let stdoutData = "";
    let stderrData = "";

    pyProcess.stdout.on("data", (data) => {
      stdoutData += data.toString();
    });

    pyProcess.stderr.on("data", (data) => {
      stderrData += data.toString();
    });

    pyProcess.on("close", async (code) => {
      console.log(`Garmin sync process exited with code ${code}`);
      const finishedAt = new Date();

      if (code === 0) {
        // Success
        // Parse python output if possible to count synced items or just mark success
        // Our script outputs: "Dane zaimportowane pomyślnie do bazy!"
        let itemsSynced = 0;
        const totalMatch = stdoutData.match(/'total':\s*(\d+)/);
        if (totalMatch) {
          itemsSynced = parseInt(totalMatch[1], 10);
        }

        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "success",
            itemsSynced,
            finishedAt,
          },
        });

        resolve(Response.json({ ok: true, message: "Synchronizacja zakończona pomyślnie", itemsSynced }));
      } else {
        // Error
        const errorMsg = stderrData || stdoutData || `Process exited with code ${code}`;
        console.error("Garmin sync error:", errorMsg);

        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "error",
            error: errorMsg.substring(0, 500), // Cap length
            finishedAt,
          },
        });

        resolve(
          Response.json(
            { error: `Błąd synchronizacji (kod ${code}): ${errorMsg.substring(0, 150)}` },
            { status: 500 }
          )
        );
      }
    });
  });
}
