package ec.sbsolutions.aulaconecta.identidad.servicio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ec.sbsolutions.aulaconecta.identidad.PruebaIntegracion;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;

@SpringBootTest
class RegistroClientesServicioTests extends PruebaIntegracion {

    @Autowired
    private RepositorioClientesServicio repositorio;

    @Autowired
    private JdbcClient jdbc;

    @TempDir
    private Path directorio;

    private RegistroClientesServicio registro(Map<String, String> alcances) {
        return new RegistroClientesServicio(
                new PropiedadesClientesServicio(directorio.toString(), alcances, Duration.ofMinutes(5)), repositorio);
    }

    private void escribirHash(String clientId, String secreto) throws IOException {
        // Igual que generar_secretos_servicio.sh: solo el hexadecimal, con salto de línea
        Files.writeString(directorio.resolve(clientId + ".sha256"),
                ClienteServicio.huella(secreto).substring("{sha256}".length()) + "\n");
    }

    @Test
    void registraLosClientesConfiguradosYDesactivaLosDemas() throws IOException {
        String secreto = UUID.randomUUID().toString();
        escribirHash("ms-academico", secreto);
        jdbc.sql("INSERT INTO cliente_servicio (client_id, hash_secreto, alcances) VALUES ('ms-retirado', 'x', 'a:b')")
                .update();

        assertThat(registro(Map.of("ms-academico", "usuarios:crear  usuarios:leer", "ms-sin-hash", "usuarios:leer"))
                .registrar(directorio)).containsExactly("ms-academico");

        ClienteServicio academico = repositorio.buscar("ms-academico").orElseThrow();
        assertThat(academico.activo()).isTrue();
        assertThat(academico.alcances()).containsExactly("usuarios:crear", "usuarios:leer");
        assertThat(academico.secretoCoincide(secreto)).isTrue();
        assertThat(repositorio.buscar("ms-retirado").orElseThrow().activo()).isFalse();
        assertThat(repositorio.buscar("ms-sin-hash")).isEmpty();
    }

    @Test
    void rotarElSecretoReemplazaElHashAnterior() throws IOException {
        escribirHash("ms-rotado", "secreto-viejo");
        registro(Map.of("ms-rotado", "usuarios:crear")).registrar(directorio);
        escribirHash("ms-rotado", "secreto-nuevo");
        registro(Map.of("ms-rotado", "usuarios:crear")).registrar(directorio);

        ClienteServicio cliente = repositorio.buscar("ms-rotado").orElseThrow();
        assertThat(cliente.secretoCoincide("secreto-nuevo")).isTrue();
        assertThat(cliente.secretoCoincide("secreto-viejo")).isFalse();
    }

    @Test
    void rechazaUnaConfiguracionPeligrosa() throws IOException {
        Files.writeString(directorio.resolve("ms-malo.sha256"), "no-es-un-hash");

        assertThatThrownBy(() -> registro(Map.of("ms-malo", "usuarios:crear")).registrar(directorio))
                .hasMessageContaining("no es un SHA-256");
        // El client_id forma el nombre del archivo: no puede salir del directorio
        assertThatThrownBy(() -> registro(Map.of("../../etc/passwd", "usuarios:crear")).registrar(directorio))
                .hasMessageContaining("mal configurado");
        assertThatThrownBy(() -> registro(Map.of("ms-alcance", "todo")).registrar(directorio))
                .hasMessageContaining("mal configurado");
    }

    @Test
    void sinDirectorioNoTocaLaTabla() {
        long antes = jdbc.sql("SELECT count(*) FROM cliente_servicio WHERE activo").query(Long.class).single();

        new RegistroClientesServicio(new PropiedadesClientesServicio("", Map.of(), Duration.ofMinutes(5)), repositorio)
                .run(null);

        assertThat(jdbc.sql("SELECT count(*) FROM cliente_servicio WHERE activo").query(Long.class).single())
                .isEqualTo(antes);
    }
}
