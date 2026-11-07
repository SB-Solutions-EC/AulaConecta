package ec.sbsolutions.aulaconecta.identidad.auditoria;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ec.sbsolutions.aulaconecta.identidad.PruebaApi;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class AuditoriaTests extends PruebaApi {

    private String admin;

    @BeforeEach
    void iniciarComoAdministrador() throws Exception {
        String nombre = "auditor." + UUID.randomUUID().toString().substring(0, 8);
        crearCuenta(nombre, "ADMIN");
        admin = token(nombre);
    }

    private JsonNode consultar(String parametros, int estado) throws Exception {
        return enviar(get("/auditoria-accesos" + parametros), admin, null, estado);
    }

    @Test
    void registraCadaEventoDeAccesoConLaIpDelCliente() throws Exception {
        UUID id = crearCuenta("ciclo.completo", "DOCENTE");
        login("ciclo.completo", "clave-equivocada", 401);
        String token = token("ciclo.completo");
        enviar(post("/auth/cambiar-clave"), token, Map.of("claveActual", CLAVE, "claveNueva", "Otra-Clave-2026"), 200);

        assertThat(eventos(id)).containsExactly("LOGIN_FALLIDO", "LOGIN_OK", "CAMBIO_CLAVE");
        JsonNode registros = consultar("?usuarioId=" + id, 200);
        assertThat(registros).hasSize(3);
        for (JsonNode registro : registros) {
            assertThat(registro.get("ip").asString()).isEqualTo("127.0.0.1");
            assertThat(registro.get("usuarioId").asString()).isEqualTo(id.toString());
        }
        // El más reciente primero
        assertThat(registros.get(0).get("evento").asString()).isEqualTo("CAMBIO_CLAVE");
    }

    @Test
    void registraLosIntentosConUsuariosQueNoExisten() throws Exception {
        String inventado = "no.existe." + UUID.randomUUID().toString().substring(0, 6);
        login(inventado, "clave-equivocada", 401);

        Long cantidad = jdbc.sql("""
                SELECT count(*) FROM auditoria_acceso
                WHERE usuario_id IS NULL AND nombre_usuario_intentado = :nombre AND evento = 'LOGIN_FALLIDO'
                """).param("nombre", inventado).query(Long.class).single();
        assertThat(cantidad).isEqualTo(1);
    }

    @Test
    void filtraPorEventoFechasYLimite() throws Exception {
        UUID id = crearCuenta("filtros.auditoria", "ESTUDIANTE");
        Instant antes = Instant.now().minusSeconds(1);
        for (int i = 0; i < 2; i++) {
            login("filtros.auditoria", "clave-equivocada", 401);
        }
        login("filtros.auditoria", CLAVE, 200);

        assertThat(consultar("?usuarioId=" + id + "&evento=LOGIN_FALLIDO", 200)).hasSize(2);
        assertThat(consultar("?usuarioId=" + id + "&evento=LOGIN_OK&desde=" + antes, 200)).hasSize(1);
        assertThat(consultar("?usuarioId=" + id + "&hasta=" + antes, 200)).isEmpty();
        assertThat(consultar("?usuarioId=" + id + "&limite=1", 200)).hasSize(1);
    }

    @Test
    void rechazaParametrosInvalidos() throws Exception {
        assertThat(consultar("?limite=0", 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
        assertThat(consultar("?limite=500", 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
        assertThat(consultar("?evento=BORRAR_TODO", 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
        assertThat(consultar("?usuarioId=no-es-uuid", 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
    }

    @Test
    void soloElAdministradorConsultaLaBitacora() throws Exception {
        crearCuenta("docente.curioso", "DOCENTE");
        enviar(get("/auditoria-accesos"), token("docente.curioso"), null, 403);
        enviar(get("/auditoria-accesos"), null, null, 401);
    }

    @Test
    void elAdministradorDesbloqueaYQuedaRegistrado() throws Exception {
        UUID id = crearCuenta("para.desbloquear", "DOCENTE");
        for (int i = 0; i < 3; i++) {
            login("para.desbloquear", "clave-equivocada", i < 2 ? 401 : 423);
        }

        JsonNode cuenta = enviar(post("/usuarios/" + id + "/desbloquear"), admin, null, 200);

        assertThat(cuenta.get("estado").asString()).isEqualTo("ACTIVO");
        assertThat(cuenta.get("intentosFallidos").asInt()).isZero();
        login("para.desbloquear", CLAVE, 200);
        assertThat(eventos(id)).containsSubsequence("BLOQUEO", "DESBLOQUEO", "LOGIN_OK");
    }

    @Test
    void alDesbloquearPuedeRestablecerLaClaveInicial() throws Exception {
        UUID id = crearCuenta("olvido.clave", "DOCENTE");

        JsonNode cuenta = enviar(post("/usuarios/" + id + "/desbloquear"), admin,
                Map.of("restablecerClaveInicial", true, "cedulaInicial", CEDULA_FICTICIA), 200);

        assertThat(cuenta.get("debeCambiarClave").asBoolean()).isTrue();
        login("olvido.clave", CLAVE, 401);
        login("olvido.clave", CEDULA_FICTICIA, 200);
    }

    @Test
    void elDesbloqueoValidaLaSolicitud() throws Exception {
        UUID id = crearCuenta("validar.desbloqueo", "DOCENTE");
        enviar(post("/usuarios/" + id + "/desbloquear"), admin, Map.of("restablecerClaveInicial", true), 400);
        enviar(post("/usuarios/" + UUID.randomUUID() + "/desbloquear"), admin, null, 404);

        jdbc.sql("UPDATE usuario SET estado = 'INACTIVO' WHERE id = :id").param("id", id).update();
        assertThat(enviar(post("/usuarios/" + id + "/desbloquear"), admin, null, 409).get("codigo").asString())
                .isEqualTo("CUENTA_INACTIVA");

        crearCuenta("docente.desbloquea", "DOCENTE");
        enviar(post("/usuarios/" + id + "/desbloquear"), token("docente.desbloquea"), null, 403);
    }

    @Test
    void laBitacoraNoSePuedeAlterarNiDesdeElServicio() {
        List<String> intentos = List.of(
                "UPDATE auditoria_acceso SET evento = 'LOGIN_OK'",
                "DELETE FROM auditoria_acceso");
        for (String sql : intentos) {
            assertThatThrownBy(() -> jdbc.sql(sql).update())
                    .hasMessageContaining("solo admite inserciones");
        }
    }
}
