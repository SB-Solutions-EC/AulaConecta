import { expect, test } from '@playwright/test';

test.describe('Historial de cambios de una nota (RNF-09)', () => {
  test('docente consulta el historial de auditoría de una calificación en la libreta', async ({
    page,
  }) => {
    await page.route('**/api/*/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'UP' }),
      });
    });

    await page.route('**/api/academico/anios-lectivos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/academico/cursos**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/academico/materias**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/academico/calificaciones**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.route('**/api/academico/auditoria**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'aud-e2e-1',
            entidad: 'CALIFICACION',
            entidadId: 'est-1',
            accion: 'CREATE',
            valorAnterior: null,
            valorNuevo: { notaFinal: 8.5, cualitativo: 'B+' },
            usuarioId: 'doc-1',
            nombreUsuario: 'Carlos Docente',
            ocurridoEn: '2026-11-20T14:00:00Z',
          },
          {
            id: 'aud-e2e-2',
            entidad: 'CALIFICACION',
            entidadId: 'est-1',
            accion: 'UPDATE',
            valorAnterior: { notaFinal: 8.5, cualitativo: 'B+' },
            valorNuevo: { notaFinal: 9.25, cualitativo: 'A-' },
            usuarioId: 'doc-1',
            nombreUsuario: 'Carlos Docente',
            ocurridoEn: '2026-11-28T11:30:00Z',
          },
        ]),
      });
    });

    await page.goto('/');

    await page.getByRole('button', { name: 'Docente' }).click();
    await page.getByTestId('nav-item-calificaciones-asistencia').click();
    await expect(
      page.getByTestId('pantalla-libreta-calificaciones'),
    ).toBeVisible();

    await page.getByTestId('boton-historial-est-1').click();
    const modal = page.getByTestId('modal-historial-nota');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('8.50');
    await expect(modal).toContainText('9.25');
    await expect(modal).toContainText('Carlos Docente');

    await page.getByTestId('filtro-accion-historial').selectOption('UPDATE');
    await expect(page.getByTestId('evento-historial-aud-e2e-2')).toBeVisible();
    await expect(page.getByTestId('evento-historial-aud-e2e-1')).toBeHidden();

    await page
      .getByRole('button', { name: /Cerrar historial de cambios/i })
      .click();
    await expect(modal).toBeHidden();
  });
});
