package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jwt.SignedJWT;
import ec.sbsolutions.aulaconecta.identidad.PruebaIntegracion;
import ec.sbsolutions.aulaconecta.identidad.seguridad.ClaveFirma;
import java.security.interfaces.RSAPublicKey;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
class AutenticacionTests extends PruebaIntegracion {

    // Hace de cédula, pero con la provincia 99, que no existe: no puede ser la de una persona real
    private static final String CLAVE_INICIAL = "9900000001";
    private static final String CLAVE_NUEVA = "Andoas-2026-segura";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private PasswordEncoder codificador;

    @Autowired
    private ClaveFirma clave;

    private final ObjectMapper json = new ObjectMapper();

    // ---------- inicio de sesión ----------

    @Test
    void conLaClaveInicialEmiteUnTokenQueObligaACambiarla() throws Exception {
        crearUsuario("docente.inicial", codificador.encode(CLAVE_INICIAL), true, "ACTIVO", null, "DOCENTE");

        JsonNode respuesta = login("docente.inicial", CLAVE_INICIAL, 200);

        assertThat(respuesta.get("tokenType").asString()).isEqualTo("Bearer");
        assertThat(respuesta.get("expiresIn").asLong()).isEqualTo(900);
        assertThat(respuesta.get("usuario").get("debeCambiarClave").asBoolean()).isTrue();
        assertThat(respuesta.get("usuario").has("hashClave")).isFalse();

        SignedJWT token = SignedJWT.parse(respuesta.get("accessToken").asString());
        assertThat(token.getHeader().getAlgorithm().getName()).isEqualTo("RS256");
        assertThat(token.getJWTClaimsSet().getSubject()).isEqualTo(respuesta.get("usuario").get("id").asString());
        assertThat(token.getJWTClaimsSet().getStringListClaim("roles")).containsExactly("DOCENTE");
        assertThat(token.getJWTClaimsSet().getBooleanClaim("debe_cambiar_clave")).isTrue();
        assertThat(token.getJWTClaimsSet().getIssuer()).isEqualTo("aulaconecta-identidad");
        assertThat(token.getJWTClaimsSet().getAudience()).containsExactly("aulaconecta");
    }

    @Test
    void elTokenSeVerificaConLaClavePublicadaEnJwks() throws Exception {
        crearUsuario("verificar.firma", codificador.encode(CLAVE_NUEVA), false, "ACTIVO", null, "ADMIN");
        SignedJWT token = SignedJWT.parse(login("verificar.firma", CLAVE_NUEVA, 200).get("accessToken").asString());

        String jwks = mvc.perform(get("/.well-known/jwks.json"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "max-age=300, public"))
                .andReturn().getResponse().getContentAsString();
        RSAKey publica = JWKSet.parse(jwks).getKeyByKeyId(token.getHeader().getKeyID()).toRSAKey();

        assertThat(token.verify(new RSASSAVerifier(publica))).isTrue();
        assertThat(publica.isPrivate()).isFalse();
        assertThat(jwks).doesNotContain("\"d\"", "\"p\"", "\"q\"");
    }

    @Test
    void elNombreDeUsuarioNoDistingueMayusculasNiEspacios() throws Exception {
        crearUsuario("mateo.rojas", codificador.encode(CLAVE_NUEVA), false, "ACTIVO", null, "ESTUDIANTE");

        login("  Mateo.Rojas ", CLAVE_NUEVA, 200);
    }

    @Test
    void claveIncorrectaYUsuarioInexistenteResponden401ConElMismoMensaje() throws Exception {
        crearUsuario("clave.incorrecta", codificador.encode(CLAVE_NUEVA), false, "ACTIVO", null, "DOCENTE");

        JsonNode claveMal = login("clave.incorrecta", "otra-clave-123", 401);
        JsonNode noExiste = login("no.existe", "otra-clave-123", 401);

        assertThat(claveMal.get("codigo").asString()).isEqualTo("CREDENCIALES_INVALIDAS");
        assertThat(claveMal.get("mensaje")).isEqualTo(noExiste.get("mensaje"));
        assertThat(claveMal.get("timestamp")).isNotNull();
    }

    @Test
    void unaCuentaInactivaNoPuedeEntrarNiConLaClaveCorrecta() throws Exception {
        crearUsuario("cuenta.inactiva", codificador.encode(CLAVE_NUEVA), false, "INACTIVO", null, "DOCENTE");

        assertThat(login("cuenta.inactiva", CLAVE_NUEVA, 401).get("codigo").asString())
                .isEqualTo("CREDENCIALES_INVALIDAS");
    }

    @Test
    void unaCuentaBloqueadaResponde423ConOSinLaClaveCorrecta() throws Exception {
        Instant enUnaHora = Instant.now().plusSeconds(3600);
        crearUsuario("cuenta.bloqueada", codificador.encode(CLAVE_NUEVA), false, "BLOQUEADO", enUnaHora, "DOCENTE");

        assertThat(login("cuenta.bloqueada", CLAVE_NUEVA, 423).get("codigo").asString()).isEqualTo("CUENTA_BLOQUEADA");
        login("cuenta.bloqueada", "otra-clave-123", 423);
    }

    @Test
    void unBloqueoVencidoYaNoImpideEntrar() throws Exception {
        Instant haceUnaHora = Instant.now().minusSeconds(3600);
        crearUsuario("bloqueo.vencido", codificador.encode(CLAVE_NUEVA), false, "BLOQUEADO", haceUnaHora, "DOCENTE");

        login("bloqueo.vencido", CLAVE_NUEVA, 200);
    }

    @Test
    void rechazaSolicitudesIncompletasOMalFormadas() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"nombreUsuario\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"))
                .andExpect(jsonPath("$.detalles.length()").value(2));
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content("no es json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("DATOS_INVALIDOS"));
    }

    // ---------- Argon2id y BCrypt ----------

    @Test
    void lasClavesSeGuardanConArgon2id() {
        assertThat(codificador.encode(CLAVE_NUEVA)).startsWith("{argon2}$argon2id$");
    }

    @Test
    void unaClaveBCryptHeredadaFuncionaYSeMigraAArgon2id() throws Exception {
        String bcrypt = "{bcrypt}" + new BCryptPasswordEncoder().encode(CLAVE_NUEVA);
        UUID id = crearUsuario("clave.heredada", bcrypt, false, "ACTIVO", null, "SECRETARIA");

        login("clave.heredada", CLAVE_NUEVA, 200);

        assertThat(hash(id)).startsWith("{argon2}$argon2id$");
        login("clave.heredada", CLAVE_NUEVA, 200);
    }

    // ---------- cambio obligatorio de la clave inicial ----------

    @Test
    void conLaClaveInicialSoloSePuedeVerLaSesionYCambiarLaClave() throws Exception {
        crearUsuario("solo.cambio", codificador.encode(CLAVE_INICIAL), true, "ACTIVO", null, "DOCENTE");
        String token = login("solo.cambio", CLAVE_INICIAL, 200).get("accessToken").asString();

        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombreUsuario").value("solo.cambio"))
                .andExpect(jsonPath("$.debeCambiarClave").value(true));
        // Cualquier otro recurso protegido queda bloqueado hasta cambiar la clave
        mvc.perform(get("/recurso-de-prueba").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    @Test
    void alCambiarLaClaveSeEmiteUnTokenCompletoYLaClaveInicialDejaDeFuncionar() throws Exception {
        UUID id = crearUsuario("cambio.completo", codificador.encode(CLAVE_INICIAL), true, "ACTIVO", null, "DOCENTE");
        String inicial = login("cambio.completo", CLAVE_INICIAL, 200).get("accessToken").asString();

        JsonNode respuesta = cambiarClave(inicial, CLAVE_INICIAL, CLAVE_NUEVA, 200);

        assertThat(respuesta.get("usuario").get("debeCambiarClave").asBoolean()).isFalse();
        assertThat(respuesta.get("usuario").get("version").asInt()).isEqualTo(1);
        assertThat(SignedJWT.parse(respuesta.get("accessToken").asString()).getJWTClaimsSet()
                .getBooleanClaim("debe_cambiar_clave")).isFalse();
        // Con el token nuevo ya pasa la regla de clave inicial (404 porque esa ruta no existe)
        mvc.perform(get("/recurso-de-prueba").header("Authorization", "Bearer " + respuesta.get("accessToken").asString()))
                .andExpect(status().isNotFound());
        login("cambio.completo", CLAVE_INICIAL, 401);
        login("cambio.completo", CLAVE_NUEVA, 200);
        assertThat(hash(id)).startsWith("{argon2}$argon2id$");
    }

    @Test
    void elCambioDeClaveValidaLaClaveActualYLaNueva() throws Exception {
        crearUsuario("validar.cambio", codificador.encode(CLAVE_INICIAL), true, "ACTIVO", null, "DOCENTE");
        String token = login("validar.cambio", CLAVE_INICIAL, 200).get("accessToken").asString();

        assertThat(cambiarClave(token, "clave-equivocada", CLAVE_NUEVA, 400).get("codigo").asString())
                .isEqualTo("CLAVE_ACTUAL_INCORRECTA");
        assertThat(cambiarClave(token, CLAVE_INICIAL, CLAVE_INICIAL, 400).get("codigo").asString())
                .isEqualTo("CLAVE_REPETIDA");
        assertThat(cambiarClave(token, CLAVE_INICIAL, "Validar.Cambio", 400).get("codigo").asString())
                .isEqualTo("CLAVE_DEBIL");
        assertThat(cambiarClave(token, CLAVE_INICIAL, "corta", 400).get("codigo").asString())
                .isEqualTo("DATOS_INVALIDOS");
    }

    // ---------- validación de los tokens ----------

    @Test
    void sinTokenOConTokenInvalidoResponde401() throws Exception {
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/auth/me").header("Authorization", "Bearer no-es-un-jwt")).andExpect(status().isUnauthorized());
    }

    @Test
    void rechazaTokensFirmadosConOtraClaveVencidosODeOtraAudiencia() throws Exception {
        UUID id = crearUsuario("token.raro", codificador.encode(CLAVE_NUEVA), false, "ACTIVO", null, "ADMIN");
        RSAKey otraClave = new RSAKeyGenerator(2048).keyID("otra").generate();

        String deOtraClave = firmar(otraClave, id, "aulaconecta", Instant.now().plusSeconds(600));
        String vencido = firmar(claveDelServicio(), id, "aulaconecta", Instant.now().minusSeconds(600));
        String otraAudiencia = firmar(claveDelServicio(), id, "otro-sistema", Instant.now().plusSeconds(600));
        String valido = firmar(claveDelServicio(), id, "aulaconecta", Instant.now().plusSeconds(600));

        for (String token : List.of(deOtraClave, vencido, otraAudiencia)) {
            mvc.perform(get("/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/auth/me").header("Authorization", "Bearer " + valido)).andExpect(status().isOk());
    }

    // ---------- utilidades ----------

    private UUID crearUsuario(String nombre, String hash, boolean debeCambiar, String estado, Instant bloqueadoHasta,
            String rol) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO usuario (id, nombre_usuario, hash_clave, debe_cambiar_clave, estado, bloqueado_hasta)
                VALUES (:id, :nombre, :hash, :debeCambiar, :estado, :bloqueadoHasta)
                """)
                .param("id", id).param("nombre", nombre).param("hash", hash).param("debeCambiar", debeCambiar)
                .param("estado", estado)
                .param("bloqueadoHasta", bloqueadoHasta == null ? null : Timestamp.from(bloqueadoHasta))
                .update();
        jdbc.sql("INSERT INTO usuario_rol (usuario_id, rol_id) SELECT :id, id FROM rol WHERE codigo = :rol")
                .param("id", id).param("rol", rol).update();
        return id;
    }

    private String hash(UUID id) {
        return jdbc.sql("SELECT hash_clave FROM usuario WHERE id = :id").param("id", id).query(String.class).single();
    }

    private JsonNode login(String nombre, String clave, int estadoEsperado) throws Exception {
        String cuerpo = json.writeValueAsString(Map.of("nombreUsuario", nombre, "clave", clave));
        MvcResult resultado = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().is(estadoEsperado))
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    private JsonNode cambiarClave(String token, String actual, String nueva, int estadoEsperado) throws Exception {
        String cuerpo = json.writeValueAsString(Map.of("claveActual", actual, "claveNueva", nueva));
        MvcResult resultado = mvc.perform(post("/auth/cambiar-clave").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().is(estadoEsperado))
                .andReturn();
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    /** La misma clave con la que firma el servicio, para fabricar tokens a medida en las pruebas. */
    private RSAKey claveDelServicio() {
        String kid = clave.conjuntoPublico().getKeys().getFirst().getKeyID();
        return new RSAKey.Builder((RSAPublicKey) CLAVES_DE_PRUEBA.getPublic())
                .privateKey(CLAVES_DE_PRUEBA.getPrivate())
                .keyID(kid)
                .build();
    }

    private static String firmar(RSAKey claveFirma, UUID sujeto, String audiencia, Instant vence) {
        JwtClaimsSet reclamos = JwtClaimsSet.builder()
                .issuer("aulaconecta-identidad")
                .audience(List.of(audiencia))
                .subject(sujeto.toString())
                .issuedAt(vence.minusSeconds(900))
                .expiresAt(vence)
                .claim("tipo", "usuario")
                .claim("roles", List.of("ADMIN"))
                .claim("debe_cambiar_clave", false)
                .build();
        JwsHeader cabecera = JwsHeader.with(SignatureAlgorithm.RS256).keyId(claveFirma.getKeyID()).build();
        return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(claveFirma)))
                .encode(JwtEncoderParameters.from(cabecera, reclamos)).getTokenValue();
    }
}
