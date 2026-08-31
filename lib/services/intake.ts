import { prisma } from "@/lib/db";
import { storage, generateKey, type StoredFile } from "@/lib/services/storage";
import {
  classifyHealthIntake,
  extractBodyComposition,
  extractBloodTestResults,
  type ClassifyResult,
} from "@/lib/services/gemini";
import {
  IntakeKind,
  IntakeStatus,
  Prisma,
} from "@/app/generated/prisma/client";
import { MAX_UPLOAD_BYTES, ALLOWED_DOCUMENT_MIME } from "@/lib/services/upload-limits";

export class IntakeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

interface UploadResult {
  intakeId: string;
  storage: StoredFile;
}

export async function persistIntakeFile(
  userId: string,
  file: { name: string; mimeType: string; data: Buffer }
): Promise<UploadResult> {
  if (file.data.length === 0) throw new IntakeError("Empty file");
  if (file.data.length > MAX_UPLOAD_BYTES) {
    throw new IntakeError(`File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)`);
  }
  const mime = file.mimeType.toLowerCase();
  if (!ALLOWED_DOCUMENT_MIME.has(mime)) {
    throw new IntakeError(`Unsupported file type: ${mime}`);
  }

  const key = generateKey(`intakes/${userId}`, file.name);
  const stored = await storage.put(key, file.data, mime);

  const intake = await prisma.healthIntake.create({
    data: {
      userId,
      fileName: file.name,
      mimeType: mime,
      fileSize: file.data.length,
      storageKey: stored.key,
      storageUrl: stored.url,
      status: IntakeStatus.UPLOADED,
    },
    select: { id: true },
  });

  return { intakeId: intake.id, storage: stored };
}

const KIND_MAP: Record<string, IntakeKind> = {
  BODY_COMPOSITION: IntakeKind.BODY_COMPOSITION,
  BLOOD_TEST: IntakeKind.BLOOD_TEST,
  HORMONES_TEST: IntakeKind.HORMONES_TEST,
  IMAGING_REPORT: IntakeKind.IMAGING_REPORT,
  MEDICATION_LABEL: IntakeKind.MEDICATION_LABEL,
  SUPPLEMENT_LABEL: IntakeKind.SUPPLEMENT_LABEL,
  WELLNESS_REPORT: IntakeKind.WELLNESS_REPORT,
  PRESCRIPTION: IntakeKind.PRESCRIPTION,
  OTHER: IntakeKind.OTHER,
};

export interface ProcessIntakeOutput {
  intakeId: string;
  status: IntakeStatus;
  kind: IntakeKind | null;
  classification: ClassifyResult | null;
  /** When EXTRACTED, the structured payload returned to the UI for review/edit. */
  extracted: Record<string, unknown> | null;
  /** Where the data was routed (target table id). */
  bodyMeasurementId?: string | null;
  healthDocumentId?: string | null;
  error?: string;
}

/**
 * Run the full classify→extract pipeline on a previously uploaded intake.
 * Always updates the HealthIntake row to reflect outcome (CLASSIFIED/EXTRACTED/FAILED).
 *
 * Note: PDF support — Gemini handles PDF inline as long as we send the right mimeType.
 */
export async function classifyAndExtractIntake(
  userId: string,
  intakeId: string,
  forceKind?: string
): Promise<ProcessIntakeOutput> {
  const intake = await prisma.healthIntake.findUnique({
    where: { id: intakeId },
    select: {
      id: true,
      userId: true,
      storageKey: true,
      mimeType: true,
      fileName: true,
    },
  });
  if (!intake || intake.userId !== userId) throw new IntakeError("Not found", 404);

  await prisma.healthIntake.update({
    where: { id: intakeId },
    data: { status: IntakeStatus.CLASSIFYING, error: null },
  });

  // Load file bytes
  const file = await storage.get(intake.storageKey);
  if (!file) {
    await prisma.healthIntake.update({
      where: { id: intakeId },
      data: { status: IntakeStatus.FAILED, error: "File not found in storage" },
    });
    return {
      intakeId,
      status: IntakeStatus.FAILED,
      kind: null,
      classification: null,
      extracted: null,
      error: "File not found in storage",
    };
  }

  const base64 = file.data.toString("base64");

  let classification: ClassifyResult;
  if (forceKind) {
    classification = {
      kind: forceKind as any,
      confidence: 1.0,
      reason: "Klasyfikacja wymuszona przez użytkownika",
      title: forceKind === "BLOOD_TEST" ? "Morfologia i biochemia krwi" : "Dokument zdrowotny",
      sourceLabel: null,
      documentDate: null,
    };
  } else {
    try {
      classification = await classifyHealthIntake(userId, base64, intake.mimeType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Classify failed";
      await prisma.healthIntake.update({
        where: { id: intakeId },
        data: { status: IntakeStatus.FAILED, error: msg },
      });
      return {
        intakeId,
        status: IntakeStatus.FAILED,
        kind: null,
        classification: null,
        extracted: null,
        error: msg,
      };
    }
  }

  const kind = forceKind
    ? (KIND_MAP[forceKind] ?? IntakeKind.OTHER)
    : (KIND_MAP[classification.kind] ?? IntakeKind.OTHER);

  await prisma.healthIntake.update({
    where: { id: intakeId },
    data: {
      kind,
      confidence: classification.confidence,
      classification: classification as unknown as Prisma.InputJsonValue,
      status: IntakeStatus.CLASSIFIED,
    },
  });

  // ─── Routing per kind ────────────────────────────────────────────────────
  if (kind === IntakeKind.BODY_COMPOSITION) {
    return await routeBodyComposition({
      userId,
      intakeId,
      classification,
      base64,
      mimeType: intake.mimeType,
    });
  }

  if (kind === IntakeKind.BLOOD_TEST || kind === IntakeKind.HORMONES_TEST) {
    return await routeBloodTest({
      userId,
      intakeId,
      classification,
      base64,
      mimeType: intake.mimeType,
    });
  }

  // For unsupported kinds, just expose classification — user can store as HealthDocument later.
  return {
    intakeId,
    status: IntakeStatus.CLASSIFIED,
    kind,
    classification,
    extracted: null,
  };
}

async function routeBodyComposition(args: {
  userId: string;
  intakeId: string;
  classification: ClassifyResult;
  base64: string;
  mimeType: string;
}): Promise<ProcessIntakeOutput> {
  const { userId, intakeId, classification, base64, mimeType } = args;

  let extracted;
  try {
    extracted = await extractBodyComposition(userId, base64, mimeType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extract failed";
    await prisma.healthIntake.update({
      where: { id: intakeId },
      data: { status: IntakeStatus.FAILED, error: msg },
    });
    return {
      intakeId,
      status: IntakeStatus.FAILED,
      kind: IntakeKind.BODY_COMPOSITION,
      classification,
      extracted: null,
      error: msg,
    };
  }

  await prisma.healthIntake.update({
    where: { id: intakeId },
    data: {
      status: IntakeStatus.EXTRACTED,
      classification: {
        ...(classification as unknown as Record<string, unknown>),
        extracted,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    intakeId,
    status: IntakeStatus.EXTRACTED,
    kind: IntakeKind.BODY_COMPOSITION,
    classification,
    extracted: extracted as unknown as Record<string, unknown>,
  };
}

async function routeBloodTest(args: {
  userId: string;
  intakeId: string;
  classification: ClassifyResult;
  base64: string;
  mimeType: string;
}): Promise<ProcessIntakeOutput> {
  const { userId, intakeId, classification, base64, mimeType } = args;

  let extracted;
  try {
    extracted = await extractBloodTestResults(userId, base64, mimeType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Extract failed";
    await prisma.healthIntake.update({
      where: { id: intakeId },
      data: { status: IntakeStatus.FAILED, error: msg },
    });
    return {
      intakeId,
      status: IntakeStatus.FAILED,
      kind: classification.kind === "HORMONES_TEST" ? IntakeKind.HORMONES_TEST : IntakeKind.BLOOD_TEST,
      classification,
      extracted: null,
      error: msg,
    };
  }

  await prisma.healthIntake.update({
    where: { id: intakeId },
    data: {
      status: IntakeStatus.EXTRACTED,
      classification: {
        ...(classification as unknown as Record<string, unknown>),
        extracted,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    intakeId,
    status: IntakeStatus.EXTRACTED,
    kind: classification.kind === "HORMONES_TEST" ? IntakeKind.HORMONES_TEST : IntakeKind.BLOOD_TEST,
    classification,
    extracted: extracted as unknown as Record<string, unknown>,
  };
}
