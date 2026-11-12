package ec.sbsolutions.aulaconecta.identidad.servicio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import ec.sbsolutions.aulaconecta.identidad.PruebaApi;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import tools.jackson.databind.JsonNode;

class TokenServicioTests extends PruebaApi {

    private String clientId;
    private String secreto;
    private UUID idCliente;

    @BeforeEach
    void registrarCliente() {
        clientId = "ms-prueba-" + UUID.randomUUID().toString().substring(0, 8);
        secreto = UUID.randomUUID() + "-" + UUID.randomUUID();
        idCliente = registrar(clientId, secreto, "usuarios:crear");
    }

    private UUID registrar(String cliente, String secretoCliente, String alcances) {
        return jdbc.sql("""
                INSERT INTO cliente_servicio (client_id, hash_secreto, alcances) VALUES (:cliente, :hash, :alcances)
                RETURNING id
                """)
                .param("cliente", cliente).param("hash", ClienteServicio.huella(secretoCliente)).param("alcances", alcances)
                .query(UUID.class).single();
    }

    private JsonNode pedirToken(String cliente, String secretoCliente, String alcance, int estado) throws Exception {
        Map<String, Object> cuerpo = new HashMap<>(Map.of("grantType", "client_credentials", "clientId", cliente,
                "clientSecret", secretoCliente));
        if (alcance != null) {
            cuerpo.put("scope", alcance);
        }
        return enviar(post("/oauth/token"), null, cuerpo, estado);
    }

    private String tokenServicio() throws Exception {
        return pedirToken(clientId, secreto, null, 200).get("accessToken").asString();
    }

    private JsonNode reclamos(String token) throws Exception {
        return json.readTree(new String(Base64.getUrlDecoder().decode(token.split("\\.")[1]), StandardCharsets.UTF_8));
    }

    private List<String> eventosDelCliente(String cliente) {
        return jdbc.sql("SELECT evento FROM auditoria_acceso WHERE nombre_usuario_intentado = :c ORDER BY ocurrido_en, id")
                .param("c", cliente).query(String.class).list();
    }

    @Test
    void emiteUnTokenDeServicioDeCincoMinutosSinRolesNiDatosPersonales() throws Exception {
        JsonNode respuesta = pedirToken(clientId, secreto, null, 200);

        assertThat(respuesta.get("tokenType").asString()).isEqualTo("Bearer");
        assertThat(respuesta.get("expiresIn").asLong()).isEqualTo(300);
        assertThat(respuesta.get("scope").asString()).isEqualTo("usuarios:crear");

        JsonNode reclamos = reclamos(respuesta.get("accessToken").asString());
        assertThat(reclamos.get("tipo").asString()).isEqualTo("servicio");
        assertThat(reclamos.get("sub").asString()).isEqualTo(idCliente.toString());
        assertThat(reclamos.get("client_id").asString()).isEqualTo(clientId);
        assertThat(reclamos.get("scope").asString()).isEqualTo("usuarios:crear");
        assertThat(reclamos.get("exp").asLong() - reclamos.get("iat").asLong()).isEqualTo(300);
        assertThat(reclamos.has("roles")).isFalse();
        assertThat(reclamos.has("debe_cambiar_clave")).isFalse();
        assertThat(eventosDelCliente(clientId)).containsExactly("TOKEN_SERVICIO");
    }

    @Test
    void laRespuestaNoSeGuardaEnCache() throws Exception {
        String cuerpo = json.writeValueAsString(Map.of("grantType", "client_credentials", "clientId", clientId,
                "clientSecret", secreto));
        mvc.perform(post("/oauth/token").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(header().string("Pragma", "no-cache"));
    }

    @Test
    void rechazaConElMismoErrorUnSecretoMaloUnClienteInexistenteOUnoInactivo() throws Exception {
        String inactivo = "ms-inactivo-" + UUID.randomUUID().toString().substring(0, 8);
        registrar(inactivo, secreto, "usuarios:crear");
        jdbc.sql("UPDATE cliente_servicio SET activo = FALSE WHERE client_id = :c").param("c", inactivo).update();

        List<JsonNode> errores = List.of(
                pedirToken(clientId, secreto + "x", null, 401),
                pedirToken("ms-no-existe", secreto, null, 401),
                pedirToken(inactivo, secreto, null, 401));

        for (JsonNode error : errores) {
            assertThat(error.get("codigo").asString()).isEqualTo("CLIENTE_INVALIDO");
            assertThat(error.get("mensaje").asString()).isEqualTo("Credenciales del servicio inválidas");
        }
        assertThat(eventosDelCliente(clientId)).containsExactly("TOKEN_SERVICIO_FALLIDO");
        assertThat(eventosDelCliente("ms-no-existe")).contains("TOKEN_SERVICIO_FALLIDO");
    }

    @Test
    void soloConcedeLosAlcancesAutorizados() throws Exception {
        assertThat(pedirToken(clientId, secreto, "usuarios:crear", 200).get("scope").asString()).isEqualTo("usuarios:crear");

        JsonNode error = pedirToken(clientId, secreto, "usuarios:crear usuarios:eliminar", 400);
        assertThat(error.get("codigo").asString()).isEqualTo("ALCANCE_INVALIDO");
        assertThat(eventosDelCliente(clientId)).containsExactly("TOKEN_SERVICIO", "TOKEN_SERVICIO_FALLIDO");
    }

    @Test
    void validaLaSolicitud() throws Exception {
        Map<String, Object> otroGrant = Map.of("grantType", "password", "clientId", clientId, "clientSecret", secreto);
        assertThat(enviar(post("/oauth/token"), null, otroGrant, 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");

        Map<String, Object> sinSecreto = Map.of("grantType", "client_credentials", "clientId", clientId);
        enviar(post("/oauth/token"), null, sinSecreto, 400);

        Map<String, Object> idConInyeccion = Map.of("grantType", "client_credentials", "clientId", "x' OR '1'='1",
                "clientSecret", secreto);
        enviar(post("/oauth/token"), null, idConInyeccion, 400);
    }

    @Test
    void conElAlcanceUsuariosCrearDaDeAltaUnaCuentaYQuedaComoResponsable() throws Exception {
        UUID id = UUID.randomUUID();
        Map<String, Object> solicitud = Map.of("id", id, "nombres", "Teresa", "apellidos", "Servicio Prueba",
                "cedulaInicial", CEDULA_FICTICIA, "roles", List.of("DOCENTE"));

        JsonNode cuenta = enviar(post("/usuarios"), tokenServicio(), solicitud, 201);

        assertThat(cuenta.get("id").asString()).isEqualTo(id.toString());
        assertThat(cuenta.get("debeCambiarClave").asBoolean()).isTrue();
        UUID asignadoPor = jdbc.sql("SELECT asignado_por FROM usuario_rol WHERE usuario_id = :id")
                .param("id", id).query(UUID.class).single();
        assertThat(asignadoPor).isEqualTo(idCliente);
        // La persona entra con su cédula y debe cambiarla
        assertThat(login(cuenta.get("nombreUsuario").asString(), CEDULA_FICTICIA, 200)
                .get("usuario").get("debeCambiarClave").asBoolean()).isTrue();
    }

    @Test
    void sinElAlcanceNoPuedeCrearCuentas() throws Exception {
        String lector = "ms-lector-" + UUID.randomUUID().toString().substring(0, 8);
        registrar(lector, secreto, "usuarios:leer");
        String token = pedirToken(lector, secreto, null, 200).get("accessToken").asString();

        enviar(post("/usuarios"), token, Map.of("nombres", "Ana", "apellidos", "Lara", "cedulaInicial", CEDULA_FICTICIA,
                "roles", List.of("DOCENTE")), 403);
    }

    @Test
    void unTokenDeServicioNoSirveComoSiFueraUnaPersona() throws Exception {
        String token = tokenServicio();
        UUID cuenta = crearCuenta("cuenta.ajena." + UUID.randomUUID().toString().substring(0, 6), "DOCENTE");

        enviar(get("/auth/me"), token, null, 403);
        enviar(post("/auth/cambiar-clave"), token, Map.of("claveActual", "x", "claveNueva", "Otra-Clave-2026"), 403);
        enviar(get("/auditoria-accesos"), token, null, 403);
        enviar(post("/usuarios/" + cuenta + "/desbloquear"), token, null, 403);
    }

    @Test
    void unaPersonaNoConsigueAlcancesDeServicio() throws Exception {
        // Un docente con un token de usuario no puede crear cuentas aunque el token sea válido
        String nombre = "docente.alcance." + UUID.randomUUID().toString().substring(0, 6);
        crearCuenta(nombre, "DOCENTE");
        JsonNode reclamos = reclamos(token(nombre));

        assertThat(reclamos.get("tipo").asString()).isEqualTo("usuario");
        assertThat(reclamos.has("scope")).isFalse();
        enviar(post("/usuarios"), token(nombre), Map.of("nombres", "Ana", "apellidos", "Lara",
                "cedulaInicial", CEDULA_FICTICIA, "roles", List.of("ADMIN")), 403);
    }
}
