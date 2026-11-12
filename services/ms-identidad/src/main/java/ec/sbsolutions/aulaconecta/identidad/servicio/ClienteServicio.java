package ec.sbsolutions.aulaconecta.identidad.servicio;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;

/** Microservicio interno que pide tokens con client credentials (tabla cliente_servicio). */
public record ClienteServicio(UUID id, String clientId, String hashSecreto, Set<String> alcances, boolean activo) {

    static final String PREFIJO_HASH = "{sha256}";

    /**
     * Huella del secreto como se guarda en la tabla. Los secretos se generan al azar con 256 bits
     * (infra/identidad/generar_secretos_servicio.sh): un hash lento como Argon2 no agrega seguridad
     * y haría de /oauth/token un punto fácil para agotar la memoria del servicio.
     */
    static String huella(String secreto) {
        try {
            byte[] resumen = MessageDigest.getInstance("SHA-256").digest(secreto.getBytes(StandardCharsets.UTF_8));
            return PREFIJO_HASH + HexFormat.of().formatHex(resumen);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("La JVM no tiene SHA-256", e);
        }
    }

    /** Comparación en tiempo constante, para no revelar cuántos caracteres coinciden. */
    boolean secretoCoincide(String secreto) {
        return MessageDigest.isEqual(huella(secreto).getBytes(StandardCharsets.UTF_8),
                hashSecreto.getBytes(StandardCharsets.UTF_8));
    }
}
