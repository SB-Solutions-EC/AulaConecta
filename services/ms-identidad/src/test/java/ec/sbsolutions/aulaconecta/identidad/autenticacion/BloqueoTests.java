package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import ec.sbsolutions.aulaconecta.identidad.PruebaApi;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class BloqueoTests extends PruebaApi {

    private static final String CLAVE_MALA = "clave-equivocada";

    private Map<String, Object> cuenta(UUID id) {
        return jdbc.sql("SELECT estado, intentos_fallidos, bloqueado_hasta FROM usuario WHERE id = :id")
                .param("id", id).query().singleRow();
    }

    @Test
    void alTercerIntentoFallidoLaCuentaSeBloquea() throws Exception {
        UUID id = crearCuenta("tres.intentos", "DOCENTE");

        assertThat(login("tres.intentos", CLAVE_MALA, 401).get("codigo").asString()).isEqualTo("CREDENCIALES_INVALIDAS");
        login("tres.intentos", CLAVE_MALA, 401);
        assertThat(login("tres.intentos", CLAVE_MALA, 423).get("codigo").asString()).isEqualTo("CUENTA_BLOQUEADA");

        Map<String, Object> estado = cuenta(id);
        assertThat(estado.get("estado")).isEqualTo("BLOQUEADO");
        assertThat(estado.get("intentos_fallidos")).isEqualTo(3);
        Instant hasta = ((Timestamp) estado.get("bloqueado_hasta")).toInstant();
        assertThat(hasta).isBetween(Instant.now().plusSeconds(14 * 60), Instant.now().plusSeconds(16 * 60));
        assertThat(eventos(id)).containsExactly("LOGIN_FALLIDO", "LOGIN_FALLIDO", "LOGIN_FALLIDO", "BLOQUEO");
    }

    @Test
    void mientrasEstaBloqueadaNiLaClaveCorrectaEntraNiSeSiguenContandoIntentos() throws Exception {
        UUID id = crearCuenta("ya.bloqueada", "DOCENTE");
        for (int i = 0; i < 3; i++) {
            login("ya.bloqueada", CLAVE_MALA, i < 2 ? 401 : 423);
        }

        login("ya.bloqueada", CLAVE, 423);
        login("ya.bloqueada", CLAVE_MALA, 423);

        assertThat(cuenta(id).get("intentos_fallidos")).isEqualTo(3);
        assertThat(eventos(id)).containsExactly("LOGIN_FALLIDO", "LOGIN_FALLIDO", "LOGIN_FALLIDO", "BLOQUEO",
                "LOGIN_FALLIDO", "LOGIN_FALLIDO");
    }

    @Test
    void unInicioCorrectoReiniciaElContador() throws Exception {
        UUID id = crearCuenta("reinicia.contador", "DOCENTE");

        login("reinicia.contador", CLAVE_MALA, 401);
        login("reinicia.contador", CLAVE_MALA, 401);
        login("reinicia.contador", CLAVE, 200);
        login("reinicia.contador", CLAVE_MALA, 401);
        login("reinicia.contador", CLAVE_MALA, 401);

        assertThat(cuenta(id).get("estado")).isEqualTo("ACTIVO");
        assertThat(cuenta(id).get("intentos_fallidos")).isEqualTo(2);
    }

    @Test
    void alVencerElBloqueoPuedeEntrarYElConteoEmpiezaDeNuevo() throws Exception {
        UUID id = crearCuenta("bloqueo.vence", "DOCENTE");
        for (int i = 0; i < 3; i++) {
            login("bloqueo.vence", CLAVE_MALA, i < 2 ? 401 : 423);
        }
        jdbc.sql("UPDATE usuario SET bloqueado_hasta = now() - interval '1 minute' WHERE id = :id").param("id", id).update();

        // Un fallo tras el vencimiento cuenta como el primero, no como el cuarto
        login("bloqueo.vence", CLAVE_MALA, 401);
        assertThat(cuenta(id).get("intentos_fallidos")).isEqualTo(1);

        login("bloqueo.vence", CLAVE, 200);
        assertThat(cuenta(id).get("estado")).isEqualTo("ACTIVO");
        assertThat(cuenta(id).get("intentos_fallidos")).isEqualTo(0);
        assertThat(cuenta(id).get("bloqueado_hasta")).isNull();
    }

    @Test
    void diezIntentosSimultaneosNoSaltanNiDeshacenElBloqueo() throws Exception {
        UUID id = crearCuenta("intentos.simultaneos", "DOCENTE");
        String cuerpo = json.writeValueAsString(Map.of("nombreUsuario", "intentos.simultaneos", "clave", CLAVE_MALA));

        ExecutorService hilos = Executors.newFixedThreadPool(10);
        List<Callable<Integer>> intentos = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            intentos.add(() -> mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                    .andReturn().getResponse().getStatus());
        }
        List<Integer> estados = new ArrayList<>();
        for (Future<Integer> resultado : hilos.invokeAll(intentos)) {
            estados.add(resultado.get());
        }
        hilos.shutdown();

        assertThat(estados).containsOnly(401, 423);
        assertThat(estados.stream().filter(e -> e == 401).count()).isEqualTo(2);
        assertThat(cuenta(id).get("estado")).isEqualTo("BLOQUEADO");
        assertThat(cuenta(id).get("intentos_fallidos")).isEqualTo(3);
        assertThat(eventos(id).stream().filter("BLOQUEO"::equals).count()).isEqualTo(1);
        // Y con la clave correcta sigue bloqueada
        login("intentos.simultaneos", CLAVE, 423);
    }
}
