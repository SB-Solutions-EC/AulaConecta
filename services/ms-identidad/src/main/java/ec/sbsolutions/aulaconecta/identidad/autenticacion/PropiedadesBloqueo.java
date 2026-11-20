package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Bloqueo temporal de la cuenta tras varios intentos fallidos seguidos (taller de riesgos, RNF-12). */
@Validated
@ConfigurationProperties("aulaconecta.bloqueo")
public record PropiedadesBloqueo(@Min(1) int intentosMaximos, @NotNull Duration duracion) {
}
