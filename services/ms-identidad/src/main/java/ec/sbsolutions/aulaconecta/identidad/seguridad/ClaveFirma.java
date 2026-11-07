package ec.sbsolutions.aulaconecta.identidad.seguridad;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.RSAPublicKeySpec;
import org.springframework.security.converter.RsaKeyConverters;
import org.springframework.stereotype.Component;

/**
 * Clave RSA con la que ms-identidad firma los tokens (RS256). El kid es la huella SHA-256 de la clave
 * pública, así cambia solo cuando cambia la clave.
 */
@Component
public class ClaveFirma {

    private static final int BITS_MINIMOS = 2048;

    private final RSAKey jwk;

    public ClaveFirma(PropiedadesJwt propiedades) throws IOException, GeneralSecurityException, JOSEException {
        RSAPrivateCrtKey privada;
        try (InputStream pem = Files.newInputStream(propiedades.clavePrivada())) {
            privada = (RSAPrivateCrtKey) RsaKeyConverters.pkcs8().convert(pem);
        }
        if (privada.getModulus().bitLength() < BITS_MINIMOS) {
            throw new IllegalStateException("La clave de firma debe tener al menos " + BITS_MINIMOS + " bits");
        }
        RSAPublicKey publica = (RSAPublicKey) KeyFactory.getInstance("RSA")
                .generatePublic(new RSAPublicKeySpec(privada.getModulus(), privada.getPublicExponent()));
        String kid = new RSAKey.Builder(publica).build().computeThumbprint().toString();
        this.jwk = new RSAKey.Builder(publica)
                .privateKey(privada)
                .keyID(kid)
                .keyUse(KeyUse.SIGNATURE)
                .algorithm(JWSAlgorithm.RS256)
                .build();
    }

    RSAKey jwk() {
        return jwk;
    }

    public RSAPublicKey publica() {
        try {
            return jwk.toRSAPublicKey();
        } catch (JOSEException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Solo la parte pública: es lo que se publica en /.well-known/jwks.json. */
    public JWKSet conjuntoPublico() {
        return new JWKSet(jwk.toPublicJWK());
    }
}
