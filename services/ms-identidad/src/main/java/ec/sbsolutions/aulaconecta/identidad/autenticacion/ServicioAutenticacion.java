package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import ec.sbsolutions.aulaconecta.identidad.error.ExcepcionApi;
import ec.sbsolutions.aulaconecta.identidad.seguridad.EmisorTokens;
import ec.sbsolutions.aulaconecta.identidad.seguridad.EmisorTokens.TokenEmitido;
import ec.sbsolutions.aulaconecta.identidad.usuario.RepositorioUsuarios;
import ec.sbsolutions.aulaconecta.identidad.usuario.Usuario;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class ServicioAutenticacion {

    private final RepositorioUsuarios usuarios;
    private final PasswordEncoder codificador;
    private final EmisorTokens emisor;

    // Se compara contra este hash cuando el usuario no existe, para que la respuesta tarde lo mismo
    // y no revele qué nombres de usuario existen.
    private final String hashSenuelo;

    public ServicioAutenticacion(RepositorioUsuarios usuarios, PasswordEncoder codificador, EmisorTokens emisor) {
        this.usuarios = usuarios;
        this.codificador = codificador;
        this.emisor = emisor;
        this.hashSenuelo = codificador.encode(UUID.randomUUID().toString());
    }

    public Sesion iniciarSesion(String nombreUsuario, String clave) {
        Usuario usuario = usuarios.buscarPorNombre(nombreUsuario.trim().toLowerCase(Locale.ROOT)).orElse(null);
        boolean claveCorrecta = codificador.matches(clave, usuario != null ? usuario.hashClave() : hashSenuelo);

        if (usuario == null || usuario.estaInactiva() || (!claveCorrecta && !usuario.estaBloqueada(Instant.now()))) {
            throw ExcepcionApi.credencialesInvalidas();
        }
        // Una cuenta bloqueada responde igual con o sin la clave correcta: así no sirve para adivinarla
        if (usuario.estaBloqueada(Instant.now())) {
            throw ExcepcionApi.cuentaBloqueada();
        }

        if (codificador.upgradeEncoding(usuario.hashClave())) {
            usuarios.actualizarHash(usuario.id(), codificador.encode(clave));
        }
        usuarios.registrarAcceso(usuario.id());
        return new Sesion(emisor.emitir(usuario), usuario);
    }

    public Sesion cambiarClave(UUID idUsuario, String claveActual, String claveNueva) {
        Usuario usuario = usuarios.buscarPorId(idUsuario).orElseThrow(ExcepcionApi::credencialesInvalidas);

        if (!codificador.matches(claveActual, usuario.hashClave())) {
            throw ExcepcionApi.solicitudInvalida("CLAVE_ACTUAL_INCORRECTA", "La clave actual no es correcta");
        }
        if (codificador.matches(claveNueva, usuario.hashClave())) {
            throw ExcepcionApi.solicitudInvalida("CLAVE_REPETIDA", "La nueva clave debe ser distinta de la actual");
        }
        if (claveNueva.equalsIgnoreCase(usuario.nombreUsuario())) {
            throw ExcepcionApi.solicitudInvalida("CLAVE_DEBIL", "La clave no puede ser igual al nombre de usuario");
        }
        if (!usuarios.cambiarClave(usuario.id(), codificador.encode(claveNueva), usuario.version())) {
            throw ExcepcionApi.conflictoVersion();
        }

        Usuario actualizado = usuarios.buscarPorId(idUsuario).orElseThrow(ExcepcionApi::credencialesInvalidas);
        return new Sesion(emisor.emitir(actualizado), actualizado);
    }

    public Usuario usuario(UUID idUsuario) {
        return usuarios.buscarPorId(idUsuario).orElseThrow(ExcepcionApi::credencialesInvalidas);
    }

    public record Sesion(TokenEmitido token, Usuario usuario) {
    }
}
