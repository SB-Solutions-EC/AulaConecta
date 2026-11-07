package ec.sbsolutions.aulaconecta.identidad;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Base de las pruebas de la API: crea cuentas directamente en la base e inicia sesión por HTTP. */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class PruebaApi extends PruebaIntegracion {

    protected static final String CLAVE = "Andoas-2026-segura";
    // Hace de cédula, pero con la provincia 99, que no existe: no puede ser la de una persona real
    protected static final String CEDULA_FICTICIA = "9900000002";

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcClient jdbc;

    @Autowired
    protected PasswordEncoder codificador;

    protected final ObjectMapper json = new ObjectMapper();

    /** Cuenta activa que ya cambió su clave inicial. */
    protected UUID crearCuenta(String nombre, String rol) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO usuario (id, nombre_usuario, hash_clave, debe_cambiar_clave)
                VALUES (:id, :nombre, :hash, FALSE)
                """)
                .param("id", id).param("nombre", nombre).param("hash", codificador.encode(CLAVE)).update();
        jdbc.sql("INSERT INTO usuario_rol (usuario_id, rol_id) SELECT :id, id FROM rol WHERE codigo = :rol")
                .param("id", id).param("rol", rol).update();
        return id;
    }

    protected String token(String nombre) throws Exception {
        return login(nombre, CLAVE, 200).get("accessToken").asString();
    }

    protected JsonNode login(String nombre, String clave, int estadoEsperado) throws Exception {
        return enviar(post("/auth/login"), null, Map.of("nombreUsuario", nombre, "clave", clave), estadoEsperado);
    }

    protected JsonNode enviar(MockHttpServletRequestBuilder peticion, String token, Object cuerpo, int estadoEsperado)
            throws Exception {
        if (token != null) {
            peticion.header("Authorization", "Bearer " + token);
        }
        if (cuerpo != null) {
            peticion.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(cuerpo));
        }
        String respuesta = mvc.perform(peticion).andExpect(status().is(estadoEsperado))
                .andReturn().getResponse().getContentAsString();
        return respuesta.isBlank() ? json.createObjectNode() : json.readTree(respuesta);
    }

    protected List<String> eventos(UUID usuarioId) {
        return jdbc.sql("SELECT evento FROM auditoria_acceso WHERE usuario_id = :id ORDER BY ocurrido_en, id")
                .param("id", usuarioId).query(String.class).list();
    }
}
