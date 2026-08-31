/**
 * Storage abstraction layer.
 *
 * Two implementations:
 *  - LocalStorageDriver: writes to ./storage on disk. Used in dev. Files are served
 *    via `/api/storage/[...key]` route handler with auth.
 *  - VercelBlobStorageDriver: stub for prod. Wired up later when we deploy.
 *
 * Switch via STORAGE_DRIVER env var (default: "local").
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export interface StoredFile {
  /** Storage-internal key, e.g. "intakes/<id>/file.jpg". Used for delete. */
  key: string;
  /** URL the app uses to fetch this file. For LocalDriver: /api/storage/<key>.
   *  For Blob: full https URL with token.
   */
  url: string;
  /** MIME of stored file. */
  mimeType: string;
  /** Size in bytes. */
  size: number;
}

export interface StorageDriver {
  /** Persist a buffer under a deterministic key (e.g. `intakes/<id>/file.jpg`). */
  put(key: string, data: Buffer, mimeType: string): Promise<StoredFile>;
  /** Fetch raw bytes by key. Returns null if missing. */
  get(key: string): Promise<{ data: Buffer; mimeType: string } | null>;
  /** Best-effort delete; no-op if missing. */
  delete(key: string): Promise<void>;
}

// ─── Local driver ────────────────────────────────────────────────────────────

function getLocalRoot(): string {
  // Computed lazily to avoid Turbopack NFT tracing the whole project from process.cwd().
  return (
    process.env.STORAGE_LOCAL_ROOT ??
    path.join(/* turbopackIgnore: true */ process.cwd(), "storage")
  );
}
const META_SUFFIX = ".meta.json";

class LocalStorageDriver implements StorageDriver {
  async put(key: string, data: Buffer, mimeType: string): Promise<StoredFile> {
    const fullPath = path.join(getLocalRoot(), key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    // Persist mime separately so GET can return correct Content-Type without sniffing.
    await fs.writeFile(`${fullPath}${META_SUFFIX}`, JSON.stringify({ mimeType, size: data.length }));
    return {
      key,
      url: `/api/storage/${encodeURI(key)}`,
      mimeType,
      size: data.length,
    };
  }

  async get(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
    // Defense-in-depth: refuse path-traversal keys.
    if (key.includes("..") || path.isAbsolute(key)) return null;
    const fullPath = path.join(getLocalRoot(), key);
    try {
      const [data, metaRaw] = await Promise.all([
        fs.readFile(fullPath),
        fs.readFile(`${fullPath}${META_SUFFIX}`, "utf8").catch(() => "{}"),
      ]);
      const meta = JSON.parse(metaRaw) as { mimeType?: string };
      return { data, mimeType: meta.mimeType ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (key.includes("..") || path.isAbsolute(key)) return;
    const fullPath = path.join(getLocalRoot(), key);
    await fs.unlink(fullPath).catch(() => undefined);
    await fs.unlink(`${fullPath}${META_SUFFIX}`).catch(() => undefined);
  }
}

// ─── Stub Vercel Blob driver (wired up later) ────────────────────────────────

class VercelBlobStorageDriver implements StorageDriver {
  async put(): Promise<StoredFile> {
    throw new Error("Vercel Blob driver not implemented yet — set STORAGE_DRIVER=local for now");
  }
  async get(): Promise<{ data: Buffer; mimeType: string } | null> {
    throw new Error("Vercel Blob driver not implemented yet");
  }
  async delete(): Promise<void> {
    throw new Error("Vercel Blob driver not implemented yet");
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

function createDriver(): StorageDriver {
  const which = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (which === "blob" || which === "vercel" || which === "vercel-blob") {
    return new VercelBlobStorageDriver();
  }
  return new LocalStorageDriver();
}

const _driver = createDriver();
export const storage: StorageDriver = _driver;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SAFE_NAME_RE = /[^a-z0-9._-]+/gi;

/** Generate a unique storage key under a prefix, preserving file extension. */
export function generateKey(prefix: string, originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().replace(SAFE_NAME_RE, "") || "";
  const stem = path
    .basename(originalName, ext)
    .replace(SAFE_NAME_RE, "_")
    .slice(0, 40)
    .replace(/_+$/, "");
  const id = randomBytes(8).toString("hex");
  const safeName = stem ? `${stem}-${id}${ext}` : `${id}${ext}`;
  return `${prefix.replace(/^\/+|\/+$/g, "")}/${id}/${safeName}`;
}
