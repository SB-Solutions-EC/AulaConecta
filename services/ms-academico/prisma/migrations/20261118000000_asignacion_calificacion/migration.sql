-- T1118-M: asignacion (docente, materia y curso) y calificacion (resumen trimestral por materia).
-- La nota final y el cualitativo los calcula ms-academico con packages/calculo.

-- CreateTable
CREATE TABLE "asignacion" (
    "id" UUID NOT NULL,
    "id_docente" UUID NOT NULL,
    "id_materia" UUID NOT NULL,
    "id_curso" UUID NOT NULL,
    "horario_resumen" VARCHAR(150),
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calificacion" (
    "id" UUID NOT NULL,
    "id_matricula" UUID NOT NULL,
    "id_asignacion" UUID NOT NULL,
    "id_periodo" UUID NOT NULL,
    "aportes_bloque1" DECIMAL(4,2)[],
    "aportes_bloque2" DECIMAL(4,2)[],
    "promedio_aportes" DECIMAL(4,2),
    "refuerzo" DECIMAL(4,2),
    "nota_proyecto" DECIMAL(4,2),
    "nota_examen" DECIMAL(4,2),
    "nota_final" DECIMAL(4,2),
    "cualitativo" CHAR(2),
    "actualizado_por" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "asignacion_id_docente_idx" ON "asignacion"("id_docente");

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_id_materia_id_curso_key" ON "asignacion"("id_materia", "id_curso");

-- CreateIndex
CREATE INDEX "calificacion_id_asignacion_id_periodo_idx" ON "calificacion"("id_asignacion", "id_periodo");

-- CreateIndex
CREATE UNIQUE INDEX "calificacion_id_matricula_id_asignacion_id_periodo_key" ON "calificacion"("id_matricula", "id_asignacion", "id_periodo");

-- AddForeignKey
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignacion" ADD CONSTRAINT "asignacion_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_id_matricula_fkey" FOREIGN KEY ("id_matricula") REFERENCES "matricula"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_id_asignacion_fkey" FOREIGN KEY ("id_asignacion") REFERENCES "asignacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_id_periodo_fkey" FOREIGN KEY ("id_periodo") REFERENCES "periodo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Notas de 0 a 10 también en la base, por si algo se salta la validación de la API
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_notas_check" CHECK (
    ("refuerzo" IS NULL OR "refuerzo" BETWEEN 0 AND 10) AND
    ("nota_proyecto" IS NULL OR "nota_proyecto" BETWEEN 0 AND 10) AND
    ("nota_examen" IS NULL OR "nota_examen" BETWEEN 0 AND 10) AND
    ("nota_final" IS NULL OR "nota_final" BETWEEN 0 AND 10) AND
    ("promedio_aportes" IS NULL OR "promedio_aportes" BETWEEN 0 AND 10) AND
    0 <= ALL ("aportes_bloque1") AND 10 >= ALL ("aportes_bloque1") AND
    0 <= ALL ("aportes_bloque2") AND 10 >= ALL ("aportes_bloque2")
);
ALTER TABLE "calificacion" ADD CONSTRAINT "calificacion_cualitativo_check" CHECK (
    "cualitativo" IS NULL OR "cualitativo" IN ('A+', 'A-', 'B+', 'B-', 'C+', 'C-', 'D+', 'D-', 'E+', 'E-')
);
