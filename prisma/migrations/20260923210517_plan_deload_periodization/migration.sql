-- Deload e periodização linear como toggles opcionais do plano, escolhidos na criação.
ALTER TABLE "workout_plans" ADD COLUMN "deload" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workout_plans" ADD COLUMN "linearPeriodization" BOOLEAN NOT NULL DEFAULT false;
