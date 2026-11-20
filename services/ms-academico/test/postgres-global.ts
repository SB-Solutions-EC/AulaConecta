import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { TestProject } from 'vitest/node';

// PostgreSQL real para las pruebas (Testcontainers, T1104-M): la misma versión del docker-compose,
// una base vacía por ejecución y las migraciones de Prisma aplicadas igual que en producción.
// Necesita Docker. Las pruebas reciben la URL con inject('urlBaseDatos').

const IMAGEN = 'postgres:16.15-alpine3.24';
let contenedor: StartedPostgreSqlContainer | undefined;

declare module 'vitest' {
  export interface ProvidedContext {
    urlBaseDatos: string;
  }
}

export async function setup(proyecto: TestProject): Promise<void> {
  contenedor = await new PostgreSqlContainer(IMAGEN)
    .withDatabase('db_academico')
    .withUsername('usr_academico')
    .withPassword('clave-solo-pruebas')
    .start();
  const url = contenedor.getConnectionUri();

  // prisma migrate deploy: falla la ejecución completa si una migración no aplica
  const raiz = resolve(__dirname, '..');
  execFileSync(process.execPath, [resolve(raiz, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], {
    cwd: raiz,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  proyecto.provide('urlBaseDatos', url);
}

export async function teardown(): Promise<void> {
  await contenedor?.stop();
}
