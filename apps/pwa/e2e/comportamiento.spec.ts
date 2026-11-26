import { expect, test } from '@playwright/test';

test.describe('Pantalla de registro de comportamiento (RF-22)', () => {
  test('docente evalúa los 9 indicadores de comportamiento y guarda el cálculo cualitativo', async ({
    page,
  }) => {
    const comportamientos = [
      {
        id: 'comp-e2e-1',
        matriculaId: 'matr-e2e-1',
        estudianteId: 'est-e2e-1',
        nombreEstudiante: 'Simulada Ana',
        trimestre: 1,
        indicadores: {
          cog1: 'FRECUENTEMENTE',
          cog2: 'FRECUENTEMENTE',
          cog3: 'FRECUENTEMENTE',
          cog4: 'FRECUENTEMENTE',
          soc1: 'FRECUENTEMENTE',
          soc2: 'FRECUENTEMENTE',
          soc3: 'FRECUENTEMENTE',
          soc4: 'FRECUENTEMENTE',
        },
        nota: 8,
        cualitativo: 'B',
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

    await page.route('**/api/academico/comportamientos**', async (route) => {
      const metodo = route.request().method();
      if (metodo === 'PUT') {
        const cuerpo = route.request().postDataJSON() as {
          matriculaId: string;
          indicadores: Record<string, string>;
          version: number;
        };
        const registro = {
          ...comportamientos[0],
          indicadores: cuerpo.indicadores,
          nota: 8,
          cualitativo: 'B',
          version: cuerpo.version + 1,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(registro),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(comportamientos),
      });
    });

    await page.goto('/');

    await page.getByRole('button', { name: 'Docente' }).click();
    await page.getByTestId('nav-item-comportamiento-estudiantil').click();
    await expect(page.getByTestId('pantalla-comportamiento')).toBeVisible();

    // Completar el 9no indicador (soc5)
    await page.getByTestId('ind-soc5-FRECUENTEMENTE').click();
    await expect(
      page.getByTestId('resultado-comportamiento-actual'),
    ).toContainText('B · Satisfactorio');

    await page.getByTestId('boton-guardar-comportamiento').click();
    await expect(
      page.getByTestId('aviso-exito-comportamiento'),
    ).toContainText('B (8.00)');
  });
});
