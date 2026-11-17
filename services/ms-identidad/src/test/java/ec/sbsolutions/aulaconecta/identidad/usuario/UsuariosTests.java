package ec.sbsolutions.aulaconecta.identidad.usuario;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ec.sbsolutions.aulaconecta.identidad.PruebaApi;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

class UsuariosTests extends PruebaApi {

    private String admin;

    @BeforeEach
    void iniciarComoAdministrador() throws Exception {
        String nombre = "admin." + UUID.randomUUID().toString().substring(0, 8);
        crearCuenta(nombre, "ADMIN");
        admin = token(nombre);
    }

    private JsonNode crear(String nombres, String apellidos, List<String> roles, int estado) throws Exception {
        return enviar(post("/usuarios"), admin, Map.of("nombres", nombres, "apellidos", apellidos, "roles", roles), estado);
    }

    @Test
    void creaLaCuentaConNombreGeneradoYUnaClaveTemporalDe72Horas() throws Exception {
        JsonNode cuenta = crear("Valeria Paola", "Vega Ruiz", List.of("DOCENTE"), 201);

        assertThat(cuenta.get("nombreUsuario").asString()).isEqualTo("valeria.vega");
        assertThat(cuenta.get("debeCambiarClave").asBoolean()).isTrue();
        assertThat(cuenta.get("estado").asString()).isEqualTo("ACTIVO");
        assertThat(cuenta.get("roles").toString()).isEqualTo("[\"DOCENTE\"]");
        // RF-03 v1.1: clave aleatoria de 10 caracteres sin símbolos ambiguos, que vence a las 72 horas
        String clave = cuenta.get("claveTemporal").asString();
        assertThat(clave).hasSize(10).matches("[" + GeneradorClaveTemporal.ALFABETO + "]+");
        Instant vence = Instant.parse(cuenta.get("claveTemporalVence").asString());
        assertThat(vence).isBetween(Instant.now().plus(Duration.ofHours(71)), Instant.now().plus(Duration.ofHours(73)));
        // Con ella se entra una vez y el token obliga a cambiarla
        assertThat(login("valeria.vega", clave, 200).get("usuario").get("debeCambiarClave").asBoolean()).isTrue();
    }

    @Test
    void conNombresRepetidosAgregaUnNumero() throws Exception {
        assertThat(crear("Sebastián", "Molina Paredes", List.of("ESTUDIANTE"), 201).get("nombreUsuario").asString())
                .isEqualTo("sebastian.molina");
        assertThat(crear("Sebastián Andrés", "Molina Ortega", List.of("ESTUDIANTE"), 201).get("nombreUsuario").asString())
                .isEqualTo("sebastian.molina2");
        assertThat(crear("SEBASTIAN", "MOLINA", List.of("ESTUDIANTE"), 201).get("nombreUsuario").asString())
                .isEqualTo("sebastian.molina3");
    }

    @Test
    void noGuardaNombresNiLaClaveEnClaroNiUnaCedulaQueLlegueDeUnClienteAntiguo() throws Exception {
        Map<String, Object> conCedula = Map.of("nombres", "Renata Gabriela", "apellidos", "Silva Montes",
                "cedulaInicial", CEDULA_FICTICIA, "roles", List.of("ESTUDIANTE"));
        JsonNode cuenta = enviar(post("/usuarios"), admin, conCedula, 201);
        UUID id = UUID.fromString(cuenta.get("id").asString());

        String fila = jdbc.sql("SELECT row_to_json(u)::text FROM usuario u WHERE id = :id").param("id", id)
                .query(String.class).single();
        assertThat(fila).doesNotContain(CEDULA_FICTICIA, "Renata", "Gabriela", "Silva Montes",
                cuenta.get("claveTemporal").asString());
        assertThat(fila).contains("$argon2id$");
        // La cédula ya no es la clave (CR-02)
        login(cuenta.get("nombreUsuario").asString(), CEDULA_FICTICIA, 401);
    }

    @Test
    void cadaCuentaRecibeUnaClaveDistinta() throws Exception {
        String primera = crear("Elena", "Rivas", List.of("ESTUDIANTE"), 201).get("claveTemporal").asString();
        String segunda = crear("Elena", "Rivas", List.of("ESTUDIANTE"), 201).get("claveTemporal").asString();

        assertThat(primera).isNotEqualTo(segunda);
    }

    @Test
    void unaPersonaPuedeTenerVariosRolesYCadaAsignacionQuedaAuditada() throws Exception {
        JsonNode cuenta = crear("Hugo", "Arias Lara", List.of("DOCENTE", "REPRESENTANTE", "DOCENTE"), 201);

        assertThat(cuenta.get("roles").toString()).isEqualTo("[\"DOCENTE\",\"REPRESENTANTE\"]");
        assertThat(eventos(UUID.fromString(cuenta.get("id").asString())))
                .containsExactly("ROL_ASIGNADO", "ROL_ASIGNADO", "CLAVE_TEMPORAL");
    }

    @Test
    void aceptaElIdentificadorQueEnviaMsAcademicoYRechazaUnoRepetido() throws Exception {
        UUID id = UUID.randomUUID();
        Map<String, Object> solicitud = Map.of("id", id, "nombres", "Lucas", "apellidos", "Espinoza",
                "roles", List.of("ESTUDIANTE"));

        assertThat(enviar(post("/usuarios"), admin, solicitud, 201).get("id").asString()).isEqualTo(id.toString());
        assertThat(enviar(post("/usuarios"), admin, solicitud, 409).get("codigo").asString()).isEqualTo("USUARIO_EXISTENTE");
    }

    @Test
    void rechazaDatosInvalidos() throws Exception {
        assertThat(crear("Ana", "Pérez", List.of(), 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
        assertThat(crear("123", "456", List.of("DOCENTE"), 400).get("codigo").asString()).isEqualTo("NOMBRE_INVALIDO");
        assertThat(crear("Ana", "Pérez", List.of("DIRECTOR"), 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
    }

    @Test
    void soloElAdministradorConSuClaveYaCambiadaPuedeCrearCuentas() throws Exception {
        Map<String, Object> solicitud = Map.of("nombres", "Nora", "apellidos", "Benítez", "roles", List.of("ADMIN"));
        crearCuenta("docente.intruso", "DOCENTE");
        enviar(post("/usuarios"), token("docente.intruso"), solicitud, 403);
        enviar(post("/usuarios"), null, solicitud, 401);

        // Un administrador que aún tiene la clave temporal tampoco puede
        JsonNode nuevoAdmin = crear("Iván", "Cordero", List.of("ADMIN"), 201);
        String tokenInicial = login(nuevoAdmin.get("nombreUsuario").asString(), nuevoAdmin.get("claveTemporal").asString(), 200)
                .get("accessToken").asString();
        enviar(post("/usuarios"), tokenInicial, solicitud, 403);
    }
}
