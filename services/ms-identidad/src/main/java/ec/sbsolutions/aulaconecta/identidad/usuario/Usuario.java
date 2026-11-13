package ec.sbsolutions.aulaconecta.identidad.usuario;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record Usuario(
        UUID id,
        String nombreUsuario,
        String hashClave,
        boolean debeCambiarClave,
        String estado,
        int intentosFallidos,
        Instant bloqueadoHasta,
        Instant ultimoAcceso,
        Instant creadoEn,
        Instant actualizadoEn,
        UUID actualizadoPor,
        int version,
        List<String> roles) {

    public static final String ACTIVO = "ACTIVO";
    public static final String BLOQUEADO = "BLOQUEADO";
    public static final String INACTIVO = "INACTIVO";

    /** Bloqueada mientras no venza el plazo; sin plazo, hasta que un administrador la desbloquee. */
    public boolean estaBloqueada(Instant ahora) {
        return BLOQUEADO.equals(estado) && (bloqueadoHasta == null || bloqueadoHasta.isAfter(ahora));
    }

    public boolean estaInactiva() {
        return INACTIVO.equals(estado);
    }
}
