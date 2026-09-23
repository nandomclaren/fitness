-- Troca a escala de esforço registrada por série de RPE (1-10, quanto maior mais perto da
-- falha) para RIR (Reps in Reserve, 0-5 em passos de 0.5, quanto menor mais perto da falha) —
-- mais concreta pro usuário ("quantas reps eu ainda tinha") e o que o app de referência usa.
-- Converte os dados existentes em vez de descartá-los: rir = 10 - rpe, limitado a [0, 5].
ALTER TABLE "set_entries" ADD COLUMN "rir" DOUBLE PRECISION;

UPDATE "set_entries" SET "rir" = GREATEST(0, LEAST(5, 10 - "rpe"));

ALTER TABLE "set_entries" ALTER COLUMN "rir" SET NOT NULL;

ALTER TABLE "set_entries" DROP COLUMN "rpe";
