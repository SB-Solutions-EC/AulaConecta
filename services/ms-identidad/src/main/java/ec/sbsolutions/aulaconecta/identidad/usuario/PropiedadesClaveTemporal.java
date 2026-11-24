package ec.sbsolutions.aulaconecta.identidad.usuario;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Clave temporal de las cuentas nuevas (RF-03 v1.1, CR-02, RN-13).
 *
 * @param vigencia cuánto sirve antes de vencer (72 horas)
 * @param longitud caracteres de la clave; con 54 símbolos posibles, 10 dan unos 57 bits
 */
@Validated
@ConfigurationProperties("aulaconecta.clave-temporal")
public record PropiedadesClaveTemporal(@NotNull Duration vigencia, @Min(10) @Max(32) int longitud) {
}
