import { expect, test } from '@playwright/test';

test.describe('Pantalla de toma de asistencia rápida en celular (RF-21)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('docente toma asistencia en móvil, aprueba justificación y confirma cambio de justificada a falta', async ({
    page,
  }) => {
    const asistencias = [
      {
        id: 'asist-e2e-1',
        asignacionId: 'cur-1-mat-1',
        matriculaId: 'matr-e2e-1',
        estudianteId: 'est-e2e-1',
        nombreEstudiante: 'Simulada Ana',
        fecha: '2026-09-15',
        estado: 'FALTA',
        justificacion: null,
        estadoJustificacion: null,
        version: 1,
      },
      {
        id: 'asist-e2e-2',
        asignacionId: 'cur-1-mat-1',
        matriculaId: 'matr-e2e-2',
        estudianteId: 'est-e2e-2',
        nombreEstudiante: 'Simulado Bruno',
        fecha: '2026-09-15',
        estado: 'FALTA',
        justificacion: 'Reposo médico confirmado',
        estadoJustificacion: 'SOLICITADA',
        version: 1,
      },
      {
        id: 'asist-e2e-3',
        asignacionId: 'cur-1-mat-1',
        matriculaId: 'matr-e2e-3',
        estudianteId: 'est-e2e-3',
        nombreEstudiante: 'Inventada Camila',
        fecha: '2026-09-15',
        estado: 'JUSTIFICADA',
        justificacion: 'Permiso previo aprobado',
        estadoJustificacion: 'APROBADA',
        version: 2,
      },
    ];

    await page.route('**/api/*/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'UP' }),
      });
    });

    await page.route('**/api/academico/anios-lectivos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'anio-1',
            nombre: '2026-2027',
            inicio: '2026-09-01',
            fin: '2027-06-30',
            activo: true,
            version: 1,
          },
        ]),
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
            nivel: '8vo EGB',
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
            codigo: 'MAT',
            nombre: 'Matemáticas',
            area: 'Ciencias Exactas',
            version: 1,
          },
        ]),
      });
    });

    await page.route('**/api/academico/asistencias**', async (route) => {
      const metodo = route.request().method();
      if (metodo === 'PUT') {
        const cuerpo = route.request().postDataJSON() as {
          matriculaId: string;
          estado: 'PRESENTE' | 'FALTA' | 'ATRASO' | 'JUSTIFICADA';
          justificacion?: string | null;
          version: number;
        };
        const encontrada = asistencias.find(
          (a) => a.matriculaId === cuerpo.matriculaId,
        );
        if (encontrada) {
          encontrada.estado = cuerpo.estado;
          encontrada.justificacion = cuerpo.justificacion ?? null;
          encontrada.estadoJustificacion =
            cuerpo.estado === 'JUSTIFICADA' ? 'APROBADA' : null;
          encontrada.version += 1;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(encontrada ?? cuerpo),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(asistencias),
      });
    });

    await page.goto('/');

    // Abrir menú móvil y cambiar a rol Docente -> Asistencia por materia
    await page.getByRole('button', { name: 'Docente' }).click();
    await page.getByRole('button', { name: /Abrir menú lateral/i }).click();
    await page.getByTestId('nav-item-asistencia-materia').click();
    await expect(page.getByTestId('pantalla-asistencia')).toBeVisible();

    // Fecha dentro del año lectivo 2026-2027
    await page.getByTestId('input-fecha-asistencia').fill('2026-09-15');

    // Marcar presente a Ana, aprobar justificación de Bruno y confirmar falta para Camila
    await page.getByTestId('btn-estado-matr-e2e-1-PRESENTE').click();
    await page.getByTestId('boton-aprobar-justificacion-matr-e2e-2').click();
    await page.getByTestId('btn-estado-matr-e2e-3-FALTA').click();

    await expect(page.getByTestId('modal-confirmar-falta')).toBeVisible();
    await page.getByTestId('boton-confirmar-cambio-falta').click();

    await page.getByTestId('boton-guardar-asistencia').click();
    await expect(page.getByTestId('aviso-exito-asistencia')).toContainText(
      '3 registros actualizados',
    );
  });
});
