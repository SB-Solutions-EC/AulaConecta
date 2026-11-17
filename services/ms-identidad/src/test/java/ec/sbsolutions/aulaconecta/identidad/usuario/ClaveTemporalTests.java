package ec.sbsolutions.aulaconecta.identidad.usuario;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import ec.sbsolutions.aulaconecta.identidad.PruebaApi;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

/** RF-03 v1.1 y RN-13 (CR-02): la clave temporal es aleatoria, de un solo uso y vence a las 72 horas. */
class ClaveTemporalTests extends PruebaApi {

    private String admin;
    private String secretaria;

    @BeforeEach
    void iniciarSesiones() throws Exception {
        String sufijo = UUID.randomUUID().toString().substring(0, 8);
        crearCuenta("admin.ct." + sufijo, "ADMIN");
        crearCuenta("secretaria.ct." + sufijo, "SECRETARIA");
        admin = token("admin.ct." + sufijo);
        secretaria = token("secretaria.ct." + sufijo);
    }

    private JsonNode nuevaCuenta() throws Exception {
        return enviar(post("/usuarios"), admin, Map.of("nombres", "Clara", "apellidos", "Temporal",
                "roles", List.of("ESTUDIANTE")), 201);
    }

    private UUID id(JsonNode cuenta) {
        return UUID.fromString(cuenta.get("id").asString());
    }

    private int intentosFallidos(UUID id) {
        return jdbc.sql("SELECT intentos_fallidos FROM usuario WHERE id = :id").param("id", id).query(Integer.class).single();
    }

    @Test
    void sirveParaUnSoloInicioDeSesion() throws Exception {
        JsonNode cuenta = nuevaCuenta();
        String usuario = cuenta.get("nombreUsuario").asString();
        String clave = cuenta.get("claveTemporal").asString();

        login(usuario, clave, 200);
        JsonNode segundo = login(usuario, clave, 401);

        assertThat(segundo.get("codigo").asString()).isEqualTo("CLAVE_TEMPORAL_USADA");
        assertThat(segundo.get("mensaje").asString()).contains("secretaría");
        // La clave era correcta: no cuenta como intento fallido ni acerca el bloqueo
        assertThat(intentosFallidos(id(cuenta))).isZero();
    }

    @Test
    void venceALas72Horas() throws Exception {
        JsonNode cuenta = nuevaCuenta();
        jdbc.sql("UPDATE usuario SET clave_temporal_vence = now() - interval '1 minute' WHERE id = :id")
                .param("id", id(cuenta)).update();

        JsonNode error = login(cuenta.get("nombreUsuario").asString(), cuenta.get("claveTemporal").asString(), 401);

        assertThat(error.get("codigo").asString()).isEqualTo("CLAVE_TEMPORAL_VENCIDA");
        assertThat(eventos(id(cuenta))).endsWith("LOGIN_FALLIDO");
    }

    @Test
    void unaClaveEquivocadaSigueContandoParaElBloqueo() throws Exception {
        JsonNode cuenta = nuevaCuenta();

        assertThat(login(cuenta.get("nombreUsuario").asString(), "no-es-la-clave", 401).get("codigo").asString())
                .isEqualTo("CREDENCIALES_INVALIDAS");
        assertThat(intentosFallidos(id(cuenta))).isEqualTo(1);
    }

    @Test
    void dosIniciosSimultaneosConLaMismaClaveSoloEntraUno() throws Exception {
        JsonNode cuenta = nuevaCuenta();
        String cuerpo = json.writeValueAsString(Map.of("nombreUsuario", cuenta.get("nombreUsuario").asString(),
                "clave", cuenta.get("claveTemporal").asString()));

        ExecutorService hilos = Executors.newFixedThreadPool(5);
        List<Callable<Integer>> intentos = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            intentos.add(() -> mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                    .andReturn().getResponse().getStatus());
        }
        List<Integer> estados = new ArrayList<>();
        for (Future<Integer> resultado : hilos.invokeAll(intentos)) {
            estados.add(resultado.get());
        }
        hilos.shutdown();

        assertThat(estados.stream().filter(e -> e == 200).count()).isEqualTo(1);
        assertThat(estados).containsOnly(200, 401);
    }

    @Test
    void alCambiarlaLaCuentaQuedaNormal() throws Exception {
        JsonNode cuenta = nuevaCuenta();
        String usuario = cuenta.get("nombreUsuario").asString();
        String temporal = cuenta.get("claveTemporal").asString();
        String sesion = login(usuario, temporal, 200).get("accessToken").asString();

        JsonNode cambio = enviar(post("/auth/cambiar-clave"), sesion,
                Map.of("claveActual", temporal, "claveNueva", "Mi-Clave-Propia-2026"), 200);

        assertThat(cambio.get("usuario").get("debeCambiarClave").asBoolean()).isFalse();
        assertThat(cambio.get("usuario").get("claveTemporalVence").isNull()).isTrue();
        // La clave propia sirve todas las veces; la temporal ya no
        login(usuario, "Mi-Clave-Propia-2026", 200);
        login(usuario, "Mi-Clave-Propia-2026", 200);
        login(usuario, temporal, 401);
    }

    @Test
    void laSecretariaGeneraOtraYLaAnteriorDejaDeServir() throws Exception {
        JsonNode cuenta = nuevaCuenta();
        String usuario = cuenta.get("nombreUsuario").asString();
        String anterior = cuenta.get("claveTemporal").asString();
        login(usuario, anterior, 200);

        String respuesta = mvc.perform(post("/usuarios/" + id(cuenta) + "/clave-temporal")
                        .header("Authorization", "Bearer " + secretaria))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString();
        JsonNode nueva = json.readTree(respuesta);

        String clave = nueva.get("claveTemporal").asString();
        assertThat(clave).isNotEqualTo(anterior).hasSize(10);
        login(usuario, anterior, 401);
        assertThat(login(usuario, clave, 200).get("usuario").get("debeCambiarClave").asBoolean()).isTrue();
        assertThat(eventos(id(cuenta))).containsSubsequence("CLAVE_TEMPORAL", "LOGIN_OK", "CLAVE_TEMPORAL");
    }

    @Test
    void soloLaSecretariaOElAdministradorGeneranClaves() throws Exception {
        JsonNode cuenta = nuevaCuenta();
        String ruta = "/usuarios/" + id(cuenta) + "/clave-temporal";

        String nueva = enviar(post(ruta), admin, null, 200).get("claveTemporal").asString();
        for (String rol : List.of("DOCENTE", "ESTUDIANTE", "REPRESENTANTE")) {
            String nombre = rol.toLowerCase() + ".ct." + UUID.randomUUID().toString().substring(0, 6);
            crearCuenta(nombre, rol);
            enviar(post(ruta), token(nombre), null, 403);
        }
        enviar(post(ruta), null, null, 401);
        // Una persona no puede pedirse una clave nueva con la temporal
        String sesionTemporal = login(cuenta.get("nombreUsuario").asString(), nueva, 200)
                .get("accessToken").asString();
        enviar(post(ruta), sesionTemporal, null, 403);
    }

    @Test
    void validaLaCuenta() throws Exception {
        enviar(post("/usuarios/" + UUID.randomUUID() + "/clave-temporal"), secretaria, null, 404);

        JsonNode cuenta = nuevaCuenta();
        jdbc.sql("UPDATE usuario SET estado = 'INACTIVO' WHERE id = :id").param("id", id(cuenta)).update();
        assertThat(enviar(post("/usuarios/" + id(cuenta) + "/clave-temporal"), secretaria, null, 409)
                .get("codigo").asString()).isEqualTo("CUENTA_INACTIVA");
    }

    @Test
    void elGeneradorUsaElAlfabetoSinAmbiguedadesYNoRepite() {
        GeneradorClaveTemporal generador = new GeneradorClaveTemporal(
                new PropiedadesClaveTemporal(java.time.Duration.ofHours(72), 12));
        Set<String> claves = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String clave = generador.generar();
            assertThat(clave).hasSize(12).doesNotContainAnyWhitespaces().matches("[" + GeneradorClaveTemporal.ALFABETO + "]+");
            assertThat(clave).doesNotContain("0", "O", "o", "1", "l", "I", "i");
            claves.add(clave);
        }
        assertThat(claves).hasSize(1000);
    }
}
