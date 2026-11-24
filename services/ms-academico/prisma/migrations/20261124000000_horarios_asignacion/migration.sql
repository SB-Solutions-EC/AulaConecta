-- T1110-M: bloques horarios de la asignación como lista JSON, igual que el contrato (BloqueHorario).
-- AlterTable
ALTER TABLE "asignacion" ADD COLUMN     "horarios" JSONB NOT NULL DEFAULT '[]';

