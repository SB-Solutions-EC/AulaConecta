package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import ec.sbsolutions.aulaconecta.identidad.usuario.Usuario;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Vista pública de una cuenta según el contrato: nunca incluye el hash de la clave. */
public record UsuarioIdentidad(
        UUID id,
        String nombreUsuario,
        List<String> roles,
        boolean debeCambiarClave,
        String estado,
        int intentosFallidos,
        Instant bloqueadoHasta,
        Instant ultimoAcceso,
        Instant creadoEn,
        Instant actualizadoEn,
        UUID actualizadoPor,
        int version) {

    public static UsuarioIdentidad de(Usuario usuario) {
        return new UsuarioIdentidad(usuario.id(), usuario.nombreUsuario(), usuario.roles(),
                usuario.debeCambiarClave(), usuario.estado(), usuario.intentosFallidos(), usuario.bloqueadoHasta(),
                usuario.ultimoAcceso(), usuario.creadoEn(), usuario.actualizadoEn(), usuario.actualizadoPor(),
                usuario.version());
    }
}
