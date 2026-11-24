import { defineConfig } from 'prisma/config';

// Prisma 7: la URL de db_academico llega por DATABASE_URL y nunca se escribe en el repositorio.
// Para generar el cliente o validar el esquema basta una URL de ejemplo; para migrar hace falta la real.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Datos de prueba ficticios (T1116-M): npm run build && npx prisma db seed
  migrations: { path: 'prisma/migrations', seed: 'node dist/semilla/sembrar.js' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://usuario:clave@localhost:5432/db_academico' },
});
