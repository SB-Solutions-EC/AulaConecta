package ec.sbsolutions.aulaconecta.identidad;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Base de las pruebas de integración: PostgreSQL real (la migración usa funciones propias de PostgreSQL)
 * y una clave de firma generada al vuelo, para no guardar ninguna clave privada en el repositorio.
 */
@Testcontainers(disabledWithoutDocker = true)
public abstract class PruebaIntegracion {

    // Un solo contenedor para toda la ejecución: Spring reutiliza el contexto entre clases de prueba,
    // y si el contenedor se reiniciara por clase, ese contexto quedaría apuntando a un puerto viejo.
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16.15-alpine3.24");

    static {
        if (DockerClientFactory.instance().isDockerAvailable()) {
            POSTGRES.start();
        }
    }

    protected static final KeyPair CLAVES_DE_PRUEBA = PemDePrueba.generar(2048);

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry registro) {
        registro.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registro.add("spring.datasource.username", POSTGRES::getUsername);
        registro.add("spring.datasource.password", POSTGRES::getPassword);
        registro.add("aulaconecta.jwt.clave-privada", PruebaIntegracion::archivoDeClave);
    }

    private static String archivoDeClave() {
        try {
            Path archivo = Files.createTempFile("jwt-prueba", ".pem");
            archivo.toFile().deleteOnExit();
            return PemDePrueba.escribir(CLAVES_DE_PRUEBA, archivo).toString();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
