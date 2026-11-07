package ec.sbsolutions.aulaconecta.identidad.usuario;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ec.sbsolutions.aulaconecta.identidad.PruebaApi;
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
        return enviar(post("/usuarios"), admin,
                Map.of("nombres", nombres, "apellidos", apellidos, "cedulaInicial", CEDULA_FICTICIA, "roles", roles),
                estado);
    }

    @Test
    void creaLaCuentaConNombreGeneradoYClaveInicial() throws Exception {
        JsonNode cuenta = crear("Valeria Paola", "Vega Ruiz", List.of("DOCENTE"), 201);

        assertThat(cuenta.get("nombreUsuario").asString()).isEqualTo("valeria.vega");
        assertThat(cuenta.get("debeCambiarClave").asBoolean()).isTrue();
        assertThat(cuenta.get("estado").asString()).isEqualTo("ACTIVO");
        assertThat(cuenta.get("roles").toString()).isEqualTo("[\"DOCENTE\"]");
        // La clave inicial es la cédula y el token obliga a cambiarla
        assertThat(login("valeria.vega", CEDULA_FICTICIA, 200).get("usuario").get("debeCambiarClave").asBoolean()).isTrue();
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
    void noGuardaLaCedulaNiLosNombresEnDbIdentidad() throws Exception {
        UUID id = UUID.fromString(crear("Renata Gabriela", "Silva Montes", List.of("ESTUDIANTE"), 201).get("id").asString());

        String fila = jdbc.sql("SELECT row_to_json(u)::text FROM usuario u WHERE id = :id").param("id", id)
                .query(String.class).single();
        assertThat(fila).doesNotContain(CEDULA_FICTICIA, "Renata", "Gabriela", "Silva Montes");
        assertThat(fila).contains("$argon2id$");
    }

    @Test
    void unaPersonaPuedeTenerVariosRolesYCadaAsignacionQuedaAuditada() throws Exception {
        JsonNode cuenta = crear("Hugo", "Arias Lara", List.of("DOCENTE", "REPRESENTANTE", "DOCENTE"), 201);

        assertThat(cuenta.get("roles").toString()).isEqualTo("[\"DOCENTE\",\"REPRESENTANTE\"]");
        assertThat(eventos(UUID.fromString(cuenta.get("id").asString())))
                .containsExactly("ROL_ASIGNADO", "ROL_ASIGNADO");
    }

    @Test
    void aceptaElIdentificadorQueEnviaMsAcademicoYRechazaUnoRepetido() throws Exception {
        UUID id = UUID.randomUUID();
        Map<String, Object> solicitud = Map.of("id", id, "nombres", "Lucas", "apellidos", "Espinoza",
                "cedulaInicial", CEDULA_FICTICIA, "roles", List.of("ESTUDIANTE"));

        assertThat(enviar(post("/usuarios"), admin, solicitud, 201).get("id").asString()).isEqualTo(id.toString());
        assertThat(enviar(post("/usuarios"), admin, solicitud, 409).get("codigo").asString()).isEqualTo("USUARIO_EXISTENTE");
    }

    @Test
    void rechazaDatosInvalidos() throws Exception {
        assertThat(crear("Ana", "Pérez", List.of(), 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
        assertThat(crear("123", "456", List.of("DOCENTE"), 400).get("codigo").asString()).isEqualTo("NOMBRE_INVALIDO");
        assertThat(crear("Ana", "Pérez", List.of("DIRECTOR"), 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
        Map<String, Object> cedulaMala = Map.of("nombres", "Ana", "apellidos", "Pérez", "cedulaInicial", "1' OR '1",
                "roles", List.of("DOCENTE"));
        assertThat(enviar(post("/usuarios"), admin, cedulaMala, 400).get("codigo").asString()).isEqualTo("DATOS_INVALIDOS");
    }

    @Test
    void soloElAdministradorConSuClaveYaCambiadaPuedeCrearCuentas() throws Exception {
        Map<String, Object> solicitud = Map.of("nombres", "Nora", "apellidos", "Benítez",
                "cedulaInicial", CEDULA_FICTICIA, "roles", List.of("ADMIN"));
        crearCuenta("docente.intruso", "DOCENTE");
        enviar(post("/usuarios"), token("docente.intruso"), solicitud, 403);
        enviar(post("/usuarios"), null, solicitud, 401);

        // Un administrador que aún tiene la clave inicial tampoco puede
        JsonNode nuevoAdmin = crear("Iván", "Cordero", List.of("ADMIN"), 201);
        String tokenInicial = login(nuevoAdmin.get("nombreUsuario").asString(), CEDULA_FICTICIA, 200)
                .get("accessToken").asString();
        enviar(post("/usuarios"), tokenInicial, solicitud, 403);
    }
}
