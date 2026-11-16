import { expect, test } from '@playwright/test';

const CEDULA_PRUEBA_SINTETICA = '9900000001';

test.describe('Pantalla de docentes y asignación de materias (RF-05)', () => {
  test('permite navegar a /docentes, registrar un docente y asignarle materia con horario', async ({
    page,
  }) => {
    const docentes: Array<{
      id: string;
      usuarioId: string;
      tipo: 'DOCENTE';
      nombres: string;
      apellidos: string;
      area: string | null;
      version: number;
    }> = [
      {
        id: 'doc-inicial-1',
        usuarioId: 'usr-inicial-1',
        tipo: 'DOCENTE',
        nombres: 'Carlos Andrés',
        apellidos: 'Mendoza Ruiz',
        area: 'Física',
        version: 1,
      },
    ];

    const asignaciones: Array<{
      id: string;
      docenteId: string;
      cursoId: string;
      materiaId: string;
      horarios?: Array<{ dia: number; hora: string }>;
      version: number;
    }> = [];

    await page.route('**/api/*/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'UP' }),
      });
    });

    await page.route('**/api/academico/cursos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'cur-1',
            anioLectivoId: 'anio-1',
            nivel: '1ro BGU',
            paralelo: 'A',
            version: 1,
          },
        ]),
      });
    });

    await page.route('**/api/academico/materias**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'mat-1',
            nombre: 'Matemáticas',
            area: 'Ciencias Exactas',
            version: 1,
          },
        ]),
      });
    });

    await page.route('**/api/academico/personas**', async (route) => {
      const metodo = route.request().method();
      if (metodo === 'POST') {
        const cuerpo = route.request().postDataJSON() as {
          nombres: string;
          apellidos: string;
          area?: string;
        };
        const creado = {
          id: `doc-${docentes.length + 1}`,
          usuarioId: `usr-${docentes.length + 1}`,
          tipo: 'DOCENTE' as const,
          nombres: cuerpo.nombres,
          apellidos: cuerpo.apellidos,
          area: cuerpo.area ?? null,
          version: 1,
        };
        docentes.push(creado);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(creado),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(docentes),
      });
    });

    await page.route('**/api/academico/asignaciones**', async (route) => {
      const metodo = route.request().method();
      if (metodo === 'POST') {
        const cuerpo = route.request().postDataJSON() as {
          docenteId: string;
          cursoId: string;
          materiaId: string;
          horarios?: Array<{ dia: number; hora: string }>;
        };
        const creada = {
          id: `asig-${asignaciones.length + 1}`,
          ...cuerpo,
          version: 1,
        };
        asignaciones.push(creada);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(creada),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(asignaciones),
      });
    });

    await page.goto('/');

    await page.getByTestId('nav-item-personal-docente').click();
    await expect(page.getByTestId('pantalla-docentes')).toBeVisible();
    await expect(page.getByText('Mendoza Ruiz Carlos Andrés')).toBeVisible();

    await page.getByLabel('Nombres').fill('Ana Lucía');
    await page.getByLabel('Apellidos').fill('Paredes Vega');
    await page.getByLabel('Cédula').fill(CEDULA_PRUEBA_SINTETICA);
    await page.getByLabel('Área académica (opcional)').fill('Matemáticas');
    await page.getByRole('button', { name: 'Registrar docente' }).click();

    await expect(page.getByText('Paredes Vega Ana Lucía')).toBeVisible();

    await page.getByRole('button', { name: 'Asignación de materias' }).click();
    await page.getByRole('button', { name: 'Agregar bloque horario' }).click();
    await page.getByRole('button', { name: 'Asignar materia' }).click();

    const listaAsignaciones = page.getByTestId('lista-asignaciones');
    await expect(listaAsignaciones).toContainText('Matemáticas · 1ro BGU "A"');
    await expect(listaAsignaciones).toContainText('Lun h1');
  });
});
