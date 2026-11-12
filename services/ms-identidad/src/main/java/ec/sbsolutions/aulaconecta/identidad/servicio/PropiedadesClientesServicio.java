package ec.sbsolutions.aulaconecta.identidad.servicio;

import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Clientes de servicio autorizados y sus alcances. El secreto de cada uno nunca llega a ms-identidad:
 * solo su SHA-256, en el archivo {@code <directorioHashes>/<clientId>.sha256} (un volumen de solo lectura).
 *
 * @param directorioHashes vacío: no se registra ningún cliente al iniciar (las pruebas los crean en la base)
 * @param alcances         client_id → alcances separados por espacios
 * @param duracionToken    vigencia de los tokens de servicio (5 minutos según el contrato)
 */
@Validated
@ConfigurationProperties("aulaconecta.clientes-servicio")
public record PropiedadesClientesServicio(String directorioHashes, Map<String, String> alcances,
        @NotNull Duration duracionToken) {

    public PropiedadesClientesServicio {
        alcances = alcances == null ? Map.of() : Map.copyOf(alcances);
    }
}
