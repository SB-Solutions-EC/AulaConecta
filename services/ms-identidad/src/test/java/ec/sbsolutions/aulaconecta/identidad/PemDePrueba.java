package ec.sbsolutions.aulaconecta.identidad;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

/** Claves RSA generadas al vuelo para las pruebas: ninguna clave privada se guarda en el repositorio. */
public final class PemDePrueba {

    private PemDePrueba() {
    }

    public static KeyPair generar(int bits) {
        try {
            KeyPairGenerator generador = KeyPairGenerator.getInstance("RSA");
            generador.initialize(bits);
            return generador.generateKeyPair();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Escribe la clave privada en formato PKCS#8, como el archivo-secreto que recibe el servicio. */
    public static Path escribir(KeyPair claves, Path archivo) throws IOException {
        String cuerpo = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
                .encodeToString(claves.getPrivate().getEncoded());
        // Solo los encabezados del formato: la clave se genera en cada ejecución de las pruebas
        String pem = "-----BEGIN PRIVATE KEY-----\n" + cuerpo + "\n-----END PRIVATE KEY-----\n"; // gitleaks:allow
        return Files.writeString(archivo, pem);
    }
}
