package ec.sbsolutions.aulaconecta.identidad.usuario;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Nombre de usuario a partir del primer nombre y el primer apellido (RF-02): "Ana Carla" + "Pérez Mora" da
 * "ana.perez". Los apellidos compuestos se conservan juntos: "De la Torre" da "delatorre".
 */
public final class GeneradorNombreUsuario {

    private static final Set<String> PARTICULAS = Set.of("de", "del", "la", "las", "los", "y", "san", "santa");
    private static final int LONGITUD_MAXIMA_BASE = 90;

    private GeneradorNombreUsuario() {
    }

    /** Devuelve "nombre.apellido" en minúsculas, sin tildes ni símbolos; null si no queda texto utilizable. */
    public static String base(String nombres, String apellidos) {
        String nombre = primeraPalabra(palabras(nombres));
        String apellido = primerApellido(palabras(apellidos));
        if (nombre.isEmpty() || apellido.isEmpty()) {
            return null;
        }
        String base = nombre + "." + apellido;
        return base.length() <= LONGITUD_MAXIMA_BASE ? base : base.substring(0, LONGITUD_MAXIMA_BASE);
    }

    /** "ana.perez" si está libre; si no, el siguiente número libre: "ana.perez2", "ana.perez3"... */
    public static String siguienteDisponible(String base, List<String> existentes) {
        Pattern patron = Pattern.compile("^" + Pattern.quote(base) + "(\\d*)$");
        int mayor = 0;
        for (String existente : existentes) {
            Matcher coincidencia = patron.matcher(existente);
            if (coincidencia.matches()) {
                String sufijo = coincidencia.group(1);
                mayor = Math.max(mayor, sufijo.isEmpty() ? 1 : Integer.parseInt(sufijo));
            }
        }
        return mayor == 0 ? base : base + (mayor + 1);
    }

    private static List<String> palabras(String texto) {
        String sinTildes = Normalizer.normalize(texto == null ? "" : texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        return Arrays.stream(sinTildes.split("[\\s-]+"))
                .map(palabra -> palabra.replaceAll("[^a-z]", ""))
                .filter(palabra -> !palabra.isEmpty())
                .toList();
    }

    private static String primeraPalabra(List<String> palabras) {
        return palabras.isEmpty() ? "" : palabras.getFirst();
    }

    private static String primerApellido(List<String> palabras) {
        StringBuilder apellido = new StringBuilder();
        for (String palabra : palabras) {
            apellido.append(palabra);
            if (!PARTICULAS.contains(palabra)) {
                break;
            }
        }
        return apellido.toString();
    }
}
