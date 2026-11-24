package ec.sbsolutions.aulaconecta.identidad.seguridad;

import ec.sbsolutions.aulaconecta.identidad.servicio.ClienteServicio;
import ec.sbsolutions.aulaconecta.identidad.usuario.Usuario;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Component;

/**
 * Emite los tokens sin datos personales. El reclamo {@code tipo} separa las dos clases de token: uno de usuario
 * (roles y si debe cambiar la clave) nunca sirve donde se espera uno de servicio (alcances), ni al revés.
 */
@Component
public class EmisorTokens {

    public static final String RECLAMO_ROLES = "roles";
    public static final String RECLAMO_CAMBIO_CLAVE = "debe_cambiar_clave";
    public static final String RECLAMO_TIPO = "tipo";
    public static final String RECLAMO_ALCANCE = "scope";
    public static final String RECLAMO_CLIENTE = "client_id";
    public static final String TIPO_USUARIO = "usuario";
    public static final String TIPO_SERVICIO = "servicio";

    private final JwtEncoder codificador;
    private final ClaveFirma clave;
    private final PropiedadesJwt propiedades;

    public EmisorTokens(JwtEncoder codificador, ClaveFirma clave, PropiedadesJwt propiedades) {
        this.codificador = codificador;
        this.clave = clave;
        this.propiedades = propiedades;
    }

    public TokenEmitido emitir(Usuario usuario) {
        JwtClaimsSet.Builder reclamos = base(usuario.id(), propiedades.duracionAcceso())
                .claim(RECLAMO_TIPO, TIPO_USUARIO)
                .claim(RECLAMO_ROLES, usuario.roles())
                .claim(RECLAMO_CAMBIO_CLAVE, usuario.debeCambiarClave());
        return firmar(reclamos, propiedades.duracionAcceso());
    }

    /** Token de servicio: el sujeto es el id del cliente en cliente_servicio y no lleva roles. */
    public TokenEmitido emitirServicio(ClienteServicio cliente, Set<String> alcances, Duration duracion) {
        JwtClaimsSet.Builder reclamos = base(cliente.id(), duracion)
                .claim(RECLAMO_TIPO, TIPO_SERVICIO)
                .claim(RECLAMO_CLIENTE, cliente.clientId())
                .claim(RECLAMO_ALCANCE, String.join(" ", alcances));
        return firmar(reclamos, duracion);
    }

    private JwtClaimsSet.Builder base(UUID sujeto, Duration duracion) {
        Instant ahora = Instant.now();
        return JwtClaimsSet.builder()
                .issuer(propiedades.emisor())
                .audience(List.of(propiedades.audiencia()))
                .subject(sujeto.toString())
                .id(UUID.randomUUID().toString())
                .issuedAt(ahora)
                .expiresAt(ahora.plus(duracion));
    }

    private TokenEmitido firmar(JwtClaimsSet.Builder reclamos, Duration duracion) {
        JwsHeader cabecera = JwsHeader.with(SignatureAlgorithm.RS256).keyId(clave.jwk().getKeyID()).build();
        String valor = codificador.encode(JwtEncoderParameters.from(cabecera, reclamos.build())).getTokenValue();
        return new TokenEmitido(valor, duracion.toSeconds());
    }

    public record TokenEmitido(String valor, long segundosDeVida) {
    }
}
