-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('DOCENTE', 'ESTUDIANTE', 'REPRESENTANTE');

-- CreateEnum
CREATE TYPE "EstadoMatricula" AS ENUM ('ACTIVA', 'RETIRADA');

-- CreateTable
CREATE TABLE "anio_lectivo" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(20) NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "anio_lectivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodo" (
    "id" UUID NOT NULL,
    "id_anio_lectivo" UUID NOT NULL,
    "numero" SMALLINT NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "cerrado" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persona" (
    "id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo" "TipoPersona" NOT NULL,
    "cedula" VARCHAR(10) NOT NULL,
    "nombres" VARCHAR(80) NOT NULL,
    "apellidos" VARCHAR(80) NOT NULL,
    "area" VARCHAR(80),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curso" (
    "id" UUID NOT NULL,
    "id_anio_lectivo" UUID NOT NULL,
    "id_tutor" UUID,
    "nivel" VARCHAR(40) NOT NULL,
    "paralelo" VARCHAR(2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materia" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "area" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "materia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matricula" (
    "id" UUID NOT NULL,
    "id_estudiante" UUID NOT NULL,
    "id_curso" UUID NOT NULL,
    "fecha_matricula" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "EstadoMatricula" NOT NULL DEFAULT 'ACTIVA',
    "version" INTEGER NOT NULL DEFAULT 1,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3),

    CONSTRAINT "matricula_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "anio_lectivo_nombre_key" ON "anio_lectivo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "periodo_id_anio_lectivo_numero_key" ON "periodo"("id_anio_lectivo", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "persona_usuario_id_key" ON "persona"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "persona_cedula_key" ON "persona"("cedula");

-- CreateIndex
CREATE INDEX "persona_tipo_idx" ON "persona"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "curso_id_anio_lectivo_nivel_paralelo_key" ON "curso"("id_anio_lectivo", "nivel", "paralelo");

-- CreateIndex
CREATE INDEX "matricula_id_curso_idx" ON "matricula"("id_curso");

-- CreateIndex
CREATE UNIQUE INDEX "matricula_id_estudiante_id_curso_key" ON "matricula"("id_estudiante", "id_curso");

-- AddForeignKey
ALTER TABLE "periodo" ADD CONSTRAINT "periodo_id_anio_lectivo_fkey" FOREIGN KEY ("id_anio_lectivo") REFERENCES "anio_lectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_id_anio_lectivo_fkey" FOREIGN KEY ("id_anio_lectivo") REFERENCES "anio_lectivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_id_tutor_fkey" FOREIGN KEY ("id_tutor") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_id_estudiante_fkey" FOREIGN KEY ("id_estudiante") REFERENCES "persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matricula" ADD CONSTRAINT "matricula_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

