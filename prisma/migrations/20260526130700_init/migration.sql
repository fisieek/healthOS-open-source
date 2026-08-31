-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "birthDate" DATETIME,
    "sex" TEXT,
    "heightCm" REAL,
    "maxHr" INTEGER,
    "restingHr" INTEGER,
    "lthr" INTEGER,
    "ftp" INTEGER,
    "vdot" REAL,
    "zonesMethod" TEXT NOT NULL DEFAULT 'PERCENT_MAX',
    "thresholdPace" REAL,
    "settings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "settings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DataSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "duration" INTEGER NOT NULL,
    "elapsedTime" INTEGER,
    "distance" REAL,
    "elevGain" REAL,
    "elevLow" REAL,
    "elevHigh" REAL,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "avgPace" REAL,
    "avgSpeed" REAL,
    "maxSpeed" REAL,
    "avgCadence" REAL,
    "avgWatts" REAL,
    "weightedAvgWatts" INTEGER,
    "maxWatts" INTEGER,
    "kilojoules" REAL,
    "avgTemp" REAL,
    "sufferScore" INTEGER,
    "calories" INTEGER,
    "description" TEXT,
    "externalUrl" TEXT,
    "gearId" TEXT,
    "deviceName" TEXT,
    "startLat" REAL,
    "startLng" REAL,
    "endLat" REAL,
    "endLng" REAL,
    "mapPolyline" TEXT,
    "mapSummaryPolyline" TEXT,
    "kudosCount" INTEGER,
    "commentCount" INTEGER,
    "prCount" INTEGER,
    "achievementCount" INTEGER,
    "moodScore" INTEGER,
    "moodNote" TEXT,
    "intensityClass" TEXT,
    "intensityClassOverride" BOOLEAN NOT NULL DEFAULT false,
    "vdotEstimate" REAL,
    "zoneMinutes" JSONB,
    "paceZoneMinutes" JSONB,
    "rawData" JSONB,
    "streams" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrengthWorkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "duration" INTEGER,
    "volume" REAL,
    "notes" TEXT,
    "moodScore" INTEGER,
    "moodNote" TEXT,
    "rawData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrengthWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrengthExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "order" INTEGER NOT NULL,
    "exerciseDefinitionId" TEXT,
    CONSTRAINT "StrengthExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "StrengthWorkout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StrengthExercise_exerciseDefinitionId_fkey" FOREIGN KEY ("exerciseDefinitionId") REFERENCES "ExerciseDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrengthSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "reps" INTEGER,
    "weight" REAL,
    "duration" INTEGER,
    "rpe" REAL,
    "isPr" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "StrengthSet_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "StrengthExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExerciseDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "muscleGroup" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REPS_WEIGHT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseDefinition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SleepSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "bedAt" DATETIME,
    "wakeAt" DATETIME,
    "totalMinutes" INTEGER,
    "deepMinutes" INTEGER,
    "remMinutes" INTEGER,
    "lightMinutes" INTEGER,
    "awakeMinutes" INTEGER,
    "efficiency" REAL,
    "rawData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SleepSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HeartRateSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "bpm" INTEGER NOT NULL,
    "type" TEXT,
    CONSTRAINT "HeartRateSample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "steps" INTEGER,
    "activeCalories" INTEGER,
    "totalCalories" INTEGER,
    "restingHr" INTEGER,
    "hrv" REAL,
    "spo2" REAL,
    "stressScore" REAL,
    "rawData" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingPlanSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetDistance" REAL,
    "targetDuration" INTEGER,
    "targetVolume" REAL,
    "notes" TEXT,
    "seriesId" TEXT,
    "recurrence" TEXT NOT NULL DEFAULT 'NONE',
    "sourceId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "intensityClass" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingPlanSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrainingSessionStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "activityId" TEXT,
    "strengthId" TEXT,
    "matchScore" REAL,
    "overriddenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingSessionStatus_planSessionId_fkey" FOREIGN KEY ("planSessionId") REFERENCES "TrainingPlanSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TrainingSessionStatus_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TrainingSessionStatus_strengthId_fkey" FOREIGN KEY ("strengthId") REFERENCES "StrengthWorkout" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "kind" TEXT,
    "confidence" REAL,
    "classification" JSONB,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "error" TEXT,
    "notes" TEXT,
    "bodyMeasurementId" TEXT,
    "healthDocumentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HealthIntake_bodyMeasurementId_fkey" FOREIGN KEY ("bodyMeasurementId") REFERENCES "BodyMeasurement" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HealthIntake_healthDocumentId_fkey" FOREIGN KEY ("healthDocumentId") REFERENCES "HealthDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "studyDate" DATETIME NOT NULL,
    "laboratory" TEXT,
    "doctor" TEXT,
    "description" TEXT,
    "tags" JSONB,
    "fileUrl" TEXT,
    "parameters" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HealthEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HealthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HealthEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "HealthDocument" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dose" TEXT,
    "frequency" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Medication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productName" TEXT,
    "company" TEXT,
    "dose" TEXT,
    "servingSize" REAL,
    "servingUnit" TEXT,
    "goal" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Supplement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplementIngredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplementId" TEXT NOT NULL,
    "nutrientId" TEXT,
    "name" TEXT NOT NULL,
    "amount" REAL,
    "unit" TEXT,
    "percentDV" REAL,
    CONSTRAINT "SupplementIngredient_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "Supplement" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplementIngredient_nutrientId_fkey" FOREIGN KEY ("nutrientId") REFERENCES "Nutrient" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplementIntake" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "supplementId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "portion" REAL NOT NULL DEFAULT 1,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "SupplementIntake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplementIntake_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "Supplement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Nutrient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "category" TEXT NOT NULL,
    "defaultUnit" TEXT NOT NULL,
    "rda" REAL,
    "upperLimit" REAL,
    "aliases" JSONB,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "weight" REAL,
    "bodyFat" REAL,
    "muscleMass" REAL,
    "waist" REAL,
    "chest" REAL,
    "hips" REAL,
    "thigh" REAL,
    "bicep" REAL,
    "calf" REAL,
    "shoulder" REAL,
    "height" REAL,
    "notes" TEXT,
    "bmi" REAL,
    "leanBodyMass" REAL,
    "boneMass" REAL,
    "bodyWaterPct" REAL,
    "proteinPct" REAL,
    "visceralFat" REAL,
    "basalMetabolism" INTEGER,
    "metabolicAge" INTEGER,
    "bodyType" TEXT,
    "bodyScore" INTEGER,
    "idealWeight" REAL,
    "skeletalMusclePct" REAL,
    "measuredAt" DATETIME,
    "waterMass" REAL,
    "fatMass" REAL,
    "proteinMass" REAL,
    "musclePct" REAL,
    "bonePct" REAL,
    "skeletalMuscleMass" REAL,
    "waistToHipRatio" REAL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceLabel" TEXT,
    "photoUrl" TEXT,
    "photoKey" TEXT,
    "extractedAt" DATETIME,
    "rawExtraction" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WellnessEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "energyScore" INTEGER,
    "moodScore" INTEGER,
    "stressScore" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WellnessEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "dataSourceId" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "itemsSynced" INTEGER,
    "error" TEXT,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncLog_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetValue" REAL,
    "unit" TEXT,
    "frequency" TEXT NOT NULL,
    "intervalDays" INTEGER,
    "step" REAL,
    "validFrom" DATETIME,
    "validTo" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HabitLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "habitId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "value" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HabitLog_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MedicalVisit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "doctorName" TEXT NOT NULL,
    "specialization" TEXT NOT NULL,
    "facility" TEXT,
    "reason" TEXT NOT NULL,
    "summary" TEXT,
    "recommendations" TEXT,
    "followUpDate" DATETIME,
    "followUpNote" TEXT,
    "documentIds" JSONB,
    "medicationIds" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MedicalVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DentalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "toothNumber" INTEGER,
    "procedure" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "dentist" TEXT,
    "facility" TEXT,
    "notes" TEXT,
    "imageUrls" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DentalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivitySubtype" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "parentType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ActivitySubtype_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_userId_type_key" ON "DataSource"("userId", "type");

-- CreateIndex
CREATE INDEX "Activity_userId_startedAt_idx" ON "Activity"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "Activity_userId_type_startedAt_idx" ON "Activity"("userId", "type", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_sourceId_source_key" ON "Activity"("userId", "sourceId", "source");

-- CreateIndex
CREATE INDEX "StrengthWorkout_userId_startedAt_idx" ON "StrengthWorkout"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StrengthWorkout_userId_sourceId_key" ON "StrengthWorkout"("userId", "sourceId");

-- CreateIndex
CREATE INDEX "ExerciseDefinition_userId_idx" ON "ExerciseDefinition"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseDefinition_userId_name_key" ON "ExerciseDefinition"("userId", "name");

-- CreateIndex
CREATE INDEX "SleepSession_userId_date_idx" ON "SleepSession"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SleepSession_userId_date_key" ON "SleepSession"("userId", "date");

-- CreateIndex
CREATE INDEX "HeartRateSample_userId_recordedAt_idx" ON "HeartRateSample"("userId", "recordedAt");

-- CreateIndex
CREATE INDEX "DailyMetric_userId_date_idx" ON "DailyMetric"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_userId_date_key" ON "DailyMetric"("userId", "date");

-- CreateIndex
CREATE INDEX "TrainingPlanSession_userId_date_idx" ON "TrainingPlanSession"("userId", "date");

-- CreateIndex
CREATE INDEX "TrainingPlanSession_seriesId_idx" ON "TrainingPlanSession"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlanSession_userId_sourceId_key" ON "TrainingPlanSession"("userId", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSessionStatus_planSessionId_key" ON "TrainingSessionStatus"("planSessionId");

-- CreateIndex
CREATE INDEX "HealthIntake_userId_createdAt_idx" ON "HealthIntake"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HealthIntake_userId_kind_idx" ON "HealthIntake"("userId", "kind");

-- CreateIndex
CREATE INDEX "HealthIntake_userId_status_idx" ON "HealthIntake"("userId", "status");

-- CreateIndex
CREATE INDEX "HealthDocument_userId_studyDate_idx" ON "HealthDocument"("userId", "studyDate");

-- CreateIndex
CREATE UNIQUE INDEX "HealthEvent_documentId_key" ON "HealthEvent"("documentId");

-- CreateIndex
CREATE INDEX "HealthEvent_userId_date_idx" ON "HealthEvent"("userId", "date");

-- CreateIndex
CREATE INDEX "Medication_userId_idx" ON "Medication"("userId");

-- CreateIndex
CREATE INDEX "Supplement_userId_idx" ON "Supplement"("userId");

-- CreateIndex
CREATE INDEX "SupplementIngredient_supplementId_idx" ON "SupplementIngredient"("supplementId");

-- CreateIndex
CREATE INDEX "SupplementIngredient_nutrientId_idx" ON "SupplementIngredient"("nutrientId");

-- CreateIndex
CREATE INDEX "SupplementIntake_userId_date_idx" ON "SupplementIntake"("userId", "date");

-- CreateIndex
CREATE INDEX "SupplementIntake_supplementId_date_idx" ON "SupplementIntake"("supplementId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Nutrient_slug_key" ON "Nutrient"("slug");

-- CreateIndex
CREATE INDEX "Nutrient_category_sortOrder_idx" ON "Nutrient"("category", "sortOrder");

-- CreateIndex
CREATE INDEX "BodyMeasurement_userId_date_idx" ON "BodyMeasurement"("userId", "date");

-- CreateIndex
CREATE INDEX "WellnessEntry_userId_date_idx" ON "WellnessEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessEntry_userId_date_key" ON "WellnessEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "SyncLog_userId_createdAt_idx" ON "SyncLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Habit_userId_idx" ON "Habit"("userId");

-- CreateIndex
CREATE INDEX "Habit_userId_validFrom_validTo_idx" ON "Habit"("userId", "validFrom", "validTo");

-- CreateIndex
CREATE INDEX "HabitLog_habitId_idx" ON "HabitLog"("habitId");

-- CreateIndex
CREATE UNIQUE INDEX "HabitLog_habitId_date_key" ON "HabitLog"("habitId", "date");

