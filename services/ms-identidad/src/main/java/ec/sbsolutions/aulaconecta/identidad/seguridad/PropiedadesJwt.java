package ec.sbsolutions.aulaconecta.identidad.seguridad;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Configuración de los tokens. La clave privada llega como archivo (un secreto montado en el
 * contenedor), nunca desde la base de datos ni desde el repositorio.
 */
@Validated
@ConfigurationProperties("aulaconecta.jwt")
public record PropiedadesJwt(
        @NotNull Path clavePrivada,
        @NotBlank String emisor,
        @NotBlank String audiencia,
        @NotNull Duration duracionAcceso) {
}
