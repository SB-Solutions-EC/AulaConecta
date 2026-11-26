import { expect, test } from '@playwright/test';

test.describe('Pantalla de parámetros configurables del colegio (RNF-10)', () => {
  test('administrador ajusta ponderaciones, ve el simulador y guarda vía API', async ({
    page,
  }) => {
    const parametros = [
      {
        id: 'par-e2e-1',
        clave: 'ponderaciones_calificaciones',
        valor: { aportes: 70, proyecto: 15, examen: 15, minimoAprobacion: 7 },
        version: 1,
      },
    ];

    await page.route('**/api/*/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'UP' }),
      });
    });

    await page.route('**/api/academico/parametros**', async (route) => {
      const metodo = route.request().method();
      if (metodo === 'PUT') {
        const cuerpo = route.request().postDataJSON() as {
          clave: string;
          valor: Record<string, unknown>;
          version: number;
        };
        const actualizado = {
          id: 'par-e2e-1',
          clave: cuerpo.clave,
          valor: cuerpo.valor,
          version: cuerpo.version + 1,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(actualizado),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(parametros),
      });
    });

    await page.goto('/');

    await page.getByTestId('nav-item-parametros-colegio').click();
    await expect(page.getByTestId('pantalla-parametros')).toBeVisible();

    await page.getByTestId('input-ponderacion-aportes').fill('60');
    await page.getByTestId('input-ponderacion-proyecto').fill('20');
    await page.getByTestId('input-ponderacion-examen').fill('20');

    await expect(page.getByTestId('simulador-ponderaciones')).toContainText(
      '8.60',
    );

    await page.getByTestId('boton-guardar-ponderaciones').click();
    await expect(page.getByTestId('aviso-exito-parametros')).toContainText(
      '60% / 20% / 20%',
    );
  });
});
