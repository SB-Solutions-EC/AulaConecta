package ec.sbsolutions.aulaconecta.identidad.usuario;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/**
 * Genera la clave temporal que la secretaría entrega a la persona (RF-03). Es aleatoria (no se deriva de
 * ningún dato personal, a diferencia de la cédula) y evita caracteres que se confunden al dictarla o
 * copiarla a mano: 0/O/o, 1/l/I/i.
 */
@Component
public class GeneradorClaveTemporal {

    static final String ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

    private final SecureRandom azar = new SecureRandom();
    private final PropiedadesClaveTemporal propiedades;

    public GeneradorClaveTemporal(PropiedadesClaveTemporal propiedades) {
        this.propiedades = propiedades;
    }

    public String generar() {
        StringBuilder clave = new StringBuilder(propiedades.longitud());
        for (int i = 0; i < propiedades.longitud(); i++) {
            clave.append(ALFABETO.charAt(azar.nextInt(ALFABETO.length())));
        }
        return clave.toString();
    }
}
