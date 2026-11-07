package ec.sbsolutions.aulaconecta.identidad.seguridad;

import ec.sbsolutions.aulaconecta.identidad.usuario.Usuario;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

/** Emite el token de acceso: solo el id, los roles y si debe cambiar la clave, sin datos personales. */
@Component
public class EmisorTokens {

    public static final String RECLAMO_ROLES = "roles";
    public static final String RECLAMO_CAMBIO_CLAVE = "debe_cambiar_clave";

    private final JwtEncoder codificador;
    private final ClaveFirma clave;
    private final PropiedadesJwt propiedades;

    public EmisorTokens(JwtEncoder codificador, ClaveFirma clave, PropiedadesJwt propiedades) {
        this.codificador = codificador;
        this.clave = clave;
        this.propiedades = propiedades;
    }

    public TokenEmitido emitir(Usuario usuario) {
        Instant ahora = Instant.now();
        JwtClaimsSet reclamos = JwtClaimsSet.builder()
                .issuer(propiedades.emisor())
                .audience(List.of(propiedades.audiencia()))
                .subject(usuario.id().toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(ahora)
                .expiresAt(ahora.plus(propiedades.duracionAcceso()))
                .claim(RECLAMO_ROLES, usuario.roles())
                .claim(RECLAMO_CAMBIO_CLAVE, usuario.debeCambiarClave())
                .build();
        JwsHeader cabecera = JwsHeader.with(SignatureAlgorithm.RS256).keyId(clave.jwk().getKeyID()).build();
        String valor = codificador.encode(JwtEncoderParameters.from(cabecera, reclamos)).getTokenValue();
        return new TokenEmitido(valor, propiedades.duracionAcceso().toSeconds());
    }

    public record TokenEmitido(String valor, long segundosDeVida) {
    }
}
