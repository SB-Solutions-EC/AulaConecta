import { expect, test } from '@playwright/test';

test.describe('Pantallas de tareas del docente y del estudiante (RF-19)', () => {
  test('docente publica proyecto, estudiante envía entrega y docente la califica', async ({
    page,
  }) => {
    const tareas: Array<{
      id: string;
      titulo: string;
      descripcion: string;
      tipo: 'TAREA' | 'PRUEBA' | 'PROYECTO';
      cursoId: string;
      materiaId: string;
      periodoId: string;
      fechaEntrega: string;
      puntajeMaximo: number;
      creadoPor: string;
      version: number;
    }> = [
      {
        id: 'tar-e2e-1',
        titulo: 'Taller de diagnóstico',
        descripcion: 'Ejercicios iniciales de álgebra.',
        tipo: 'TAREA',
        cursoId: 'cur-1',
        materiaId: 'mat-1',
        periodoId: 'per-1',
        fechaEntrega: '2026-11-28',
        puntajeMaximo: 10,
        creadoPor: 'docente.e2e',
        version: 1,
      },
    ];

    const entregas: Array<{
      id: string;
      tareaId: string;
      estudianteId: string;
      nombreEstudiante: string;
      comentario: string;
      enlaceAdjunto?: string;
      estado: 'PENDIENTE' | 'ENTREGADA' | 'CALIFICADA';
      calificacion: number | null;
      observacionDocente?: string;
      fechaEntregaReal?: string;
      version: number;
    }> = [];

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

    await page.route('**/api/academico/periodos**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'per-1',
            anioLectivoId: 'anio-1',
            numero: 1,
            inicio: '2026-09-01',
            fin: '2026-11-30',
            cerrado: false,
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

    await page.route('**/api/academico/tareas/*/entregas', async (route) => {
      const metodo = route.request().method();
      const url = route.request().url();
      const match = /\/tareas\/([^/]+)\/entregas/.exec(url);
      const tareaId = match ? decodeURIComponent(match[1]) : '';

      if (metodo === 'POST') {
        const cuerpo = route.request().postDataJSON() as {
          estudianteId?: string;
          nombreEstudiante?: string;
          comentario: string;
          enlaceAdjunto?: string;
        };
        const nueva = {
          id: `ent-e2e-${entregas.length + 1}`,
          tareaId,
          estudianteId: cuerpo.estudianteId ?? 'ana.perez',
          nombreEstudiante: cuerpo.nombreEstudiante ?? 'ana.perez',
          comentario: cuerpo.comentario,
          enlaceAdjunto: cuerpo.enlaceAdjunto,
          estado: 'ENTREGADA' as const,
          calificacion: null,
          fechaEntregaReal: '2026-11-19',
          version: 1,
        };
        entregas.push(nueva);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(nueva),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(entregas.filter((e) => e.tareaId === tareaId)),
      });
    });

    await page.route('**/api/academico/entregas/*/calificar', async (route) => {
      const url = route.request().url();
      const match = /\/entregas\/([^/]+)\/calificar/.exec(url);
      const entregaId = match ? decodeURIComponent(match[1]) : '';
      const cuerpo = route.request().postDataJSON() as {
        calificacion: number;
        observacionDocente?: string;
      };

      const encontrada = entregas.find((e) => e.id === entregaId);
      if (encontrada) {
        encontrada.estado = 'CALIFICADA';
        encontrada.calificacion = cuerpo.calificacion;
        encontrada.observacionDocente = cuerpo.observacionDocente;
        encontrada.version += 1;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(encontrada ?? {}),
      });
    });

    await page.route('**/api/academico/tareas**', async (route) => {
      const metodo = route.request().method();
      if (metodo === 'POST') {
        const cuerpo = route.request().postDataJSON() as {
          titulo: string;
          descripcion: string;
          tipo: 'TAREA' | 'PRUEBA' | 'PROYECTO';
          cursoId: string;
          materiaId: string;
          periodoId: string;
          fechaEntrega: string;
          puntajeMaximo: number;
        };
        const creada = {
          id: `tar-e2e-${tareas.length + 1}`,
          ...cuerpo,
          creadoPor: 'ana.perez',
          version: 1,
        };
        tareas.unshift(creada);
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
        body: JSON.stringify(tareas),
      });
    });

    await page.goto('/');

    // 1. Cambiar a rol Docente y navegar a Tareas
    await page.getByRole('button', { name: 'Docente' }).click();
    await page.getByTestId('nav-item-tareas-evaluaciones').click();
    await expect(page.getByTestId('vista-tareas-docente')).toBeVisible();

    // 2. Publicar un nuevo proyecto
    await page
      .getByTestId('input-titulo-tarea')
      .fill('Maqueta del sistema solar');
    await page.getByTestId('select-tipo-tarea').selectOption('PROYECTO');
    await page
      .getByTestId('input-descripcion-tarea')
      .fill('Presentar maqueta con escalas aproximadas.');
    await page.getByTestId('boton-publicar-tarea').click();

    await expect(page.getByText('Maqueta del sistema solar')).toBeVisible();

    // 3. Cambiar a rol Estudiante y enviar la entrega
    await page.getByRole('button', { name: 'Estudiante' }).click();
    await expect(page.getByTestId('vista-tareas-estudiante')).toBeVisible();
    await expect(page.getByTestId('estado-entrega-tar-e2e-2')).toHaveText(
      'Pendiente',
    );

    await page.getByTestId('boton-abrir-entrega-tar-e2e-2').click();
    await page
      .getByTestId('input-comentario-entrega')
      .fill('Adjunto informe y fotos de la maqueta.');
    await page.getByTestId('boton-confirmar-entrega').click();

    await expect(page.getByTestId('estado-entrega-tar-e2e-2')).toHaveText(
      'Entregada',
    );

    // 4. Volver a Docente, revisar entregas y calificar
    await page.getByRole('button', { name: 'Docente' }).click();
    await page.getByTestId('boton-ver-entregas-tar-e2e-2').click();
    await expect(page.getByTestId('modal-entregas-docente')).toBeVisible();

    await page.getByTestId('input-nota-entrega-ent-e2e-1').fill('9.5');
    await page
      .getByTestId('input-observacion-entrega-ent-e2e-1')
      .fill('Excelente trabajo');
    await page.getByTestId('boton-calificar-entrega-ent-e2e-1').click();

    await expect(page.getByTestId('aviso-exito-tareas')).toContainText('9.50');
    await page.getByRole('button', { name: /Cerrar revisión de entregas/i }).click();

    // 5. Volver a Estudiante y verificar calificación y retroalimentación recibidas (RF-20)
    await page.getByRole('button', { name: 'Estudiante' }).click();
    await expect(page.getByTestId('estado-entrega-tar-e2e-2')).toContainText(
      'Calificada · 9.50 / 10',
    );
    await expect(page.getByText('Excelente trabajo')).toBeVisible();

    await page
      .getByTestId('filtro-estado-tareas-estudiante')
      .selectOption('CALIFICADA');
    await page.getByTestId('boton-ver-retroalimentacion-tar-e2e-2').click();

    const modalDetalle = page.getByTestId('modal-retroalimentacion-estudiante');
    await expect(modalDetalle).toBeVisible();
    await expect(modalDetalle).toContainText('9.50 / 10');
    await expect(modalDetalle).toContainText('DA');
    await expect(
      page.getByTestId('detalle-retroalimentacion-docente'),
    ).toContainText('Excelente trabajo');

    await page
      .getByRole('button', { name: /Cerrar detalle de calificación/i })
      .click();
    await expect(modalDetalle).toBeHidden();
  });
});
