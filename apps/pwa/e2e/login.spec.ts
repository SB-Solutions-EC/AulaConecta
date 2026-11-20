import { expect, test, type Page } from '@playwright/test';

const URL_AMBIENTE_PRUEBAS = process.env.E2E_BASE_URL?.trim();
const CLAVE_AMBIENTE_PRUEBAS = process.env.E2E_CLAVE_PRUEBA?.trim();
const ES_AMBIENTE_REAL = Boolean(URL_AMBIENTE_PRUEBAS);

const CLAVE_INICIAL_FICTICIA = '9900000001';
const CLAVE_PRUEBA_SIMULADA = 'aaaaaaaa';
const CLAVE_NUEVA_SIMULADA = 'bbbbbbbb';
const TOKEN_SIMULADO = 'aaaaaaaa';
const TOKEN_RENOVADO_SIMULADO = 'bbbbbbbb';

type RolPrueba = 'ADMIN' | 'SECRETARIA' | 'DOCENTE' | 'ESTUDIANTE' | 'REPRESENTANTE';

interface UsuarioMock {
  id: string;
  nombreUsuario: string;
  roles: RolPrueba[];
  debeCambiarClave: boolean;
}

const CUENTAS_PRUEBA: Record<string, UsuarioMock> = {
  'rosa.prueba': {
    id: '14e5c1e4-d3e5-5ce9-8e88-f6ba05a40cf4',
    nombreUsuario: 'rosa.prueba',
    roles: ['ADMIN'],
    debeCambiarClave: false,
  },
  'marta.ficticia': {
    id: '998ad770-90b1-54f6-a8e0-14bfcdef839c',
    nombreUsuario: 'marta.ficticia',
    roles: ['DOCENTE'],
    debeCambiarClave: false,
  },
  'luis.prueba': {
    id: '35048519-e720-5e4c-81d9-fe8f142d61fc',
    nombreUsuario: 'luis.prueba',
    roles: ['SECRETARIA'],
    debeCambiarClave: true,
  },
};

function construirRespuestaToken(usuario: UsuarioMock, token = TOKEN_SIMULADO) {
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn: 900,
    usuario: {
      ...usuario,
      estado: 'ACTIVO',
      intentosFallidos: 0,
      version: 1,
    },
  };
}

async function configurarMocksAutenticacion(
  page: Page,
  opciones: { forzarBloqueo?: boolean } = {},
) {
  await page.route('**/api/*/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'UP' }),
    });
  });

  await page.route('**/api/identidad/auth/login', async (route) => {
    const cuerpo = route.request().postDataJSON() as {
      nombreUsuario?: string;
      clave?: string;
    };

    if (opciones.forzarBloqueo) {
      await route.fulfill({
        status: 423,
        contentType: 'application/json',
        body: JSON.stringify({
          codigo: 'CUENTA_BLOQUEADA',
          mensaje:
            'Cuenta bloqueada temporalmente por superar 3 intentos fallidos.',
        }),
      });
      return;
    }

    const cuenta = cuerpo.nombreUsuario
      ? CUENTAS_PRUEBA[cuerpo.nombreUsuario]
      : undefined;
    const claveEsperada = cuenta?.debeCambiarClave
      ? CLAVE_INICIAL_FICTICIA
      : CLAVE_PRUEBA_SIMULADA;

    if (!cuenta || cuerpo.clave !== claveEsperada) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          codigo: 'CREDENCIALES_INVALIDAS',
          mensaje: 'Usuario o contraseña incorrectos.',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(construirRespuestaToken(cuenta)),
    });
  });

  await page.route('**/api/identidad/auth/cambiar-clave', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        construirRespuestaToken(
          { ...CUENTAS_PRUEBA['luis.prueba'], debeCambiarClave: false },
          TOKEN_RENOVADO_SIMULADO,
        ),
      ),
    });
  });

  await page.route('**/api/identidad/auth/logout', async (route) => {
    await route.fulfill({
      status: 204,
      body: '',
    });
  });
}

async function abrirPantallaLogin(page: Page) {
  await page.goto('/');
  const pantallaLogin = page.getByTestId('pantalla-inicio-sesion');
  if (!(await pantallaLogin.isVisible())) {
    await page.getByTestId('toggle-sesion').click();
  }
  await expect(pantallaLogin).toBeVisible();
}

async function enviarCredenciales(
  page: Page,
  nombreUsuario: string,
  clave: string,
) {
  await page.locator('#campo-nombre-usuario').fill(nombreUsuario);
  await page.locator('#campo-clave-acceso').fill(clave);
  await page.getByTestId('boton-enviar-login').click();
}

function obtenerClaveParaCuenta(nombreUsuario: string): string {
  if (ES_AMBIENTE_REAL) {
    if (!CLAVE_AMBIENTE_PRUEBAS) {
      throw new Error(
        'Define E2E_CLAVE_PRUEBA para ejecutar la prueba e2e contra el ambiente real.',
      );
    }
    return CLAVE_AMBIENTE_PRUEBAS;
  }
  const cuenta = CUENTAS_PRUEBA[nombreUsuario];
  return cuenta?.debeCambiarClave ? CLAVE_INICIAL_FICTICIA : CLAVE_PRUEBA_SIMULADA;
}

test.describe('Prueba e2e de login contra el ambiente de pruebas (T1116-C, RF-01, RF-03, RNF-12)', () => {
  test('rechaza credenciales inválidas mostrando alerta sin autenticar', async ({
    page,
  }) => {
    if (!ES_AMBIENTE_REAL) {
      await configurarMocksAutenticacion(page);
    }

    await abrirPantallaLogin(page);
    await enviarCredenciales(page, 'usuario.inexistente', CLAVE_NUEVA_SIMULADA);

    const alerta = page.getByTestId('alerta-error-login');
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText(/Credenciales inválidas/i);
    await expect(page.getByTestId('vista-no-autenticado')).toBeVisible();
  });

  test('inicia sesión como ADMIN (rosa.prueba), verifica menú autorizado y cierra sesión', async ({
    page,
  }) => {
    test.skip(
      ES_AMBIENTE_REAL && !CLAVE_AMBIENTE_PRUEBAS,
      'Falta E2E_CLAVE_PRUEBA para autenticar cuentas reales en el ambiente de pruebas.',
    );

    if (!ES_AMBIENTE_REAL) {
      await configurarMocksAutenticacion(page);
    }

    await abrirPantallaLogin(page);
    await enviarCredenciales(
      page,
      'rosa.prueba',
      obtenerClaveParaCuenta('rosa.prueba'),
    );

    await expect(page.getByTestId('vista-no-autenticado')).toBeHidden();
    await expect(page.getByTestId('usuario-sesion-activa')).toHaveText(
      'rosa.prueba',
    );
    await expect(
      page.getByTestId('nav-item-configuracion-academica'),
    ).toBeVisible();
    await expect(page.getByTestId('nav-item-personal-docente')).toBeVisible();
    await expect(page.getByTestId('nav-item-matriculas')).toBeVisible();

    await page.getByTestId('boton-cerrar-sesion').click();

    await expect(page.getByTestId('vista-no-autenticado')).toBeVisible();
    await expect(page.getByTestId('aviso-cierre-sesion')).toContainText(
      /Sesión finalizada correctamente/i,
    );
  });

  test('inicia sesión como DOCENTE (marta.ficticia) y restringe el menú al rol', async ({
    page,
  }) => {
    test.skip(
      ES_AMBIENTE_REAL && !CLAVE_AMBIENTE_PRUEBAS,
      'Falta E2E_CLAVE_PRUEBA para autenticar cuentas reales en el ambiente de pruebas.',
    );

    if (!ES_AMBIENTE_REAL) {
      await configurarMocksAutenticacion(page);
    }

    await abrirPantallaLogin(page);
    await enviarCredenciales(
      page,
      'marta.ficticia',
      obtenerClaveParaCuenta('marta.ficticia'),
    );

    await expect(page.getByTestId('vista-no-autenticado')).toBeHidden();
    await expect(page.getByTestId('usuario-sesion-activa')).toHaveText(
      'marta.ficticia',
    );
    await expect(
      page.getByTestId('nav-item-calificaciones-asistencia'),
    ).toBeVisible();
    await expect(
      page.getByTestId('nav-item-planificaciones-erca'),
    ).toBeVisible();
    await expect(
      page.getByTestId('nav-item-configuracion-academica'),
    ).toHaveCount(0);
    await expect(page.getByTestId('nav-item-personal-docente')).toHaveCount(0);
    await expect(page.getByTestId('nav-item-matriculas')).toHaveCount(0);
  });

  test('exige cambio obligatorio de clave inicial (RF-03) y desbloquea la sesión tras actualizarla', async ({
    page,
  }) => {
    test.skip(
      ES_AMBIENTE_REAL,
      'Las cuentas sembradas en el ambiente real ya completaron su clave inicial (ver infra/datos-prueba/README.md).',
    );

    await configurarMocksAutenticacion(page);
    await abrirPantallaLogin(page);
    await enviarCredenciales(page, 'luis.prueba', CLAVE_INICIAL_FICTICIA);

    const vistaCambioClave = page.getByTestId('vista-cambio-clave-obligatorio');
    await expect(vistaCambioClave).toBeVisible();
    await expect(vistaCambioClave).toContainText('luis.prueba');

    await page.locator('#campo-clave-actual').fill(CLAVE_INICIAL_FICTICIA);
    await page.locator('#campo-clave-nueva').fill(CLAVE_NUEVA_SIMULADA);
    await page.locator('#campo-confirmar-clave').fill(CLAVE_NUEVA_SIMULADA);
    await page.getByTestId('boton-guardar-cambio-clave').click();

    await expect(vistaCambioClave).toBeHidden();
    await expect(page.getByTestId('usuario-sesion-activa')).toHaveText(
      'luis.prueba',
    );
    await expect(page.getByTestId('nav-item-matriculas')).toBeVisible();
  });

  test('muestra aviso de cuenta bloqueada temporalmente ante respuesta 423 (RNF-12)', async ({
    page,
  }) => {
    test.skip(
      ES_AMBIENTE_REAL,
      'Evita bloquear cuentas compartidas en el ambiente real de pruebas.',
    );

    await configurarMocksAutenticacion(page, { forzarBloqueo: true });
    await abrirPantallaLogin(page);
    await enviarCredenciales(page, 'rosa.prueba', CLAVE_NUEVA_SIMULADA);

    const alerta = page.getByTestId('alerta-error-login');
    await expect(alerta).toBeVisible();
    await expect(alerta).toContainText(/Cuenta bloqueada temporalmente/i);
  });
});
