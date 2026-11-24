package ec.sbsolutions.aulaconecta.identidad.seguridad;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ec.sbsolutions.aulaconecta.identidad.PemDePrueba;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class ClaveFirmaTests {

    @TempDir
    Path carpeta;

    @Test
    void rechazaClavesDeMenosDe2048Bits() throws Exception {
        Path pem = PemDePrueba.escribir(PemDePrueba.generar(1024), carpeta.resolve("corta.pem"));

        assertThatThrownBy(() -> new ClaveFirma(propiedades(pem)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("2048");
    }

    @Test
    void publicaSoloLaPartePublicaYUnKidEstable() throws Exception {
        Path pem = PemDePrueba.escribir(PemDePrueba.generar(2048), carpeta.resolve("clave.pem"));

        ClaveFirma clave = new ClaveFirma(propiedades(pem));
        ClaveFirma mismaClave = new ClaveFirma(propiedades(pem));

        assertThat(clave.conjuntoPublico().getKeys()).hasSize(1);
        assertThat(clave.conjuntoPublico().getKeys().getFirst().isPrivate()).isFalse();
        assertThat(clave.jwk().getKeyID()).isEqualTo(mismaClave.jwk().getKeyID());
        assertThat(clave.publica().getModulus()).isEqualTo(mismaClave.publica().getModulus());
    }

    private static PropiedadesJwt propiedades(Path pem) {
        return new PropiedadesJwt(pem, "aulaconecta-identidad", "aulaconecta", Duration.ofMinutes(15));
    }
}
