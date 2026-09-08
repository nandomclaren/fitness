-- CreateTable
CREATE TABLE "workout_sessions" (
    "id" TEXT NOT NULL,
    "split" TEXT NOT NULL,
    "exerciseIds" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "workout_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "set_entries" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "reps" INTEGER NOT NULL,
    "rpe" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "set_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_records" (
    "exerciseId" TEXT NOT NULL,
    "bestEstOneRepMax" DOUBLE PRECISION NOT NULL,
    "bestWeightKg" DOUBLE PRECISION NOT NULL,
    "bestReps" INTEGER NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "personal_records_pkey" PRIMARY KEY ("exerciseId")
);

-- CreateTable
CREATE TABLE "user_goals" (
    "id" TEXT NOT NULL DEFAULT 'me',
    "objective" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "daysPerWeek" INTEGER NOT NULL,
    "equipment" TEXT[],
    "limitations" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "set_entries_exerciseId_idx" ON "set_entries"("exerciseId");

-- CreateIndex
CREATE INDEX "set_entries_sessionId_idx" ON "set_entries"("sessionId");

-- AddForeignKey
ALTER TABLE "set_entries" ADD CONSTRAINT "set_entries_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "workout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
