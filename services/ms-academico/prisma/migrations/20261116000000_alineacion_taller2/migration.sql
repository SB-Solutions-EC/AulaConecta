-- Alineación con el diccionario de datos del Taller 2 (docs/analisis/Grupo01_Taller2_2.pdf):
--   persona: datos opcionales (fecha_nacimiento, sexo, telefono, correo único, direccion)
--   materia: código corto único (p. ej. MAT); el área pasa a ser opcional
--   matricula: código visible único (p. ej. AND-2026-0001)
-- Las columnas obligatorias se agregan en tres pasos (agregar, rellenar, NOT NULL) para que la migración
-- también aplique en bases locales que ya tengan materias o matrículas.

-- persona
ALTER TABLE "persona" ADD COLUMN "correo" VARCHAR(120),
ADD COLUMN "direccion" VARCHAR(200),
ADD COLUMN "fecha_nacimiento" DATE,
ADD COLUMN "sexo" CHAR(1),
ADD COLUMN "telefono" VARCHAR(10);
ALTER TABLE "persona" ADD CONSTRAINT "persona_sexo_check" CHECK ("sexo" IS NULL OR "sexo" IN ('M', 'F'));
CREATE UNIQUE INDEX "persona_correo_key" ON "persona"("correo");

-- materia
ALTER TABLE "materia" ADD COLUMN "codigo" VARCHAR(10);
UPDATE "materia" SET "codigo" = 'M' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 9)) WHERE "codigo" IS NULL;
ALTER TABLE "materia" ALTER COLUMN "codigo" SET NOT NULL,
ALTER COLUMN "area" DROP NOT NULL;
CREATE UNIQUE INDEX "materia_codigo_key" ON "materia"("codigo");

-- matricula
ALTER TABLE "matricula" ADD COLUMN "codigo_matricula" VARCHAR(15);
UPDATE "matricula" SET "codigo_matricula" = 'AND-' || UPPER(SUBSTRING(REPLACE("id"::text, '-', '') FROM 1 FOR 11)) WHERE "codigo_matricula" IS NULL;
ALTER TABLE "matricula" ALTER COLUMN "codigo_matricula" SET NOT NULL;
CREATE UNIQUE INDEX "matricula_codigo_matricula_key" ON "matricula"("codigo_matricula");
