-- Agendamento de início de plano: status "scheduled" + data em que deve virar ativo sozinho.
ALTER TABLE "workout_plans" ADD COLUMN "scheduledFor" TIMESTAMP(3);
