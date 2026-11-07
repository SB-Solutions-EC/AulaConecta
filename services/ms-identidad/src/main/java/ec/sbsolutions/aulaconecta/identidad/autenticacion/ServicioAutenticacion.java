package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import ec.sbsolutions.aulaconecta.identidad.auditoria.EventoAcceso;
import ec.sbsolutions.aulaconecta.identidad.auditoria.RepositorioAuditoria;
import ec.sbsolutions.aulaconecta.identidad.error.ExcepcionApi;
import ec.sbsolutions.aulaconecta.identidad.seguridad.EmisorTokens;
import ec.sbsolutions.aulaconecta.identidad.seguridad.EmisorTokens.TokenEmitido;
import ec.sbsolutions.aulaconecta.identidad.usuario.RepositorioUsuarios;
import ec.sbsolutions.aulaconecta.identidad.usuario.Usuario;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Inicio de sesión y cambio de clave. El inicio de sesión no usa una transacción a propósito: cada sentencia se
 * confirma sola, así el intento fallido y su registro de auditoría quedan guardados aunque la respuesta sea un error.
 */
@Service
public class ServicioAutenticacion {

    private final RepositorioUsuarios usuarios;
    private final RepositorioAuditoria auditoria;
    private final PasswordEncoder codificador;
    private final EmisorTokens emisor;
    private final PropiedadesBloqueo bloqueo;

    // Se compara contra este hash cuando el usuario no existe, para que la respuesta tarde lo mismo
    // y no revele qué nombres de usuario existen.
    private final String hashSenuelo;

    public ServicioAutenticacion(RepositorioUsuarios usuarios, RepositorioAuditoria auditoria,
            PasswordEncoder codificador, EmisorTokens emisor, PropiedadesBloqueo bloqueo) {
        this.usuarios = usuarios;
        this.auditoria = auditoria;
        this.codificador = codificador;
        this.emisor = emisor;
        this.bloqueo = bloqueo;
        this.hashSenuelo = codificador.encode(UUID.randomUUID().toString());
    }

    public Sesion iniciarSesion(String nombreUsuario, String clave, String ip) {
        String nombre = nombreUsuario.trim().toLowerCase(Locale.ROOT);
        Usuario usuario = usuarios.buscarPorNombre(nombre).orElse(null);
        boolean claveCorrecta = codificador.matches(clave, usuario != null ? usuario.hashClave() : hashSenuelo);

        if (usuario == null || usuario.estaInactiva()) {
            auditoria.registrar(EventoAcceso.LOGIN_FALLIDO, usuario != null ? usuario.id() : null, nombre, ip);
            throw ExcepcionApi.credencialesInvalidas();
        }
        // Una cuenta bloqueada responde igual con o sin la clave correcta: así no sirve para adivinarla
        if (usuario.estaBloqueada(Instant.now())) {
            auditoria.registrar(EventoAcceso.LOGIN_FALLIDO, usuario.id(), nombre, ip);
            throw ExcepcionApi.cuentaBloqueada();
        }
        if (!claveCorrecta) {
            registrarFallo(usuario, nombre, ip);
        }

        if (!usuarios.registrarAccesoExitoso(usuario.id())) {
            // Otro intento la bloqueó entre la lectura y este momento
            auditoria.registrar(EventoAcceso.LOGIN_FALLIDO, usuario.id(), nombre, ip);
            throw ExcepcionApi.cuentaBloqueada();
        }
        if (codificador.upgradeEncoding(usuario.hashClave())) {
            usuarios.actualizarHash(usuario.id(), codificador.encode(clave));
        }
        auditoria.registrar(EventoAcceso.LOGIN_OK, usuario.id(), nombre, ip);
        Usuario actualizado = usuarios.buscarPorId(usuario.id()).orElseThrow();
        return new Sesion(emisor.emitir(actualizado), actualizado);
    }

    private void registrarFallo(Usuario usuario, String nombre, String ip) {
        Optional<String> estado = usuarios.registrarFallo(usuario.id(), bloqueo.intentosMaximos(),
                bloqueo.duracion().toSeconds());
        auditoria.registrar(EventoAcceso.LOGIN_FALLIDO, usuario.id(), nombre, ip);
        if (estado.isEmpty()) {
            // Otro intento simultáneo ya la bloqueó: este no cuenta ni vuelve a registrar el bloqueo
            throw ExcepcionApi.cuentaBloqueada();
        }
        if (Usuario.BLOQUEADO.equals(estado.get())) {
            auditoria.registrar(EventoAcceso.BLOQUEO, usuario.id(), nombre, ip);
            throw ExcepcionApi.cuentaBloqueada();
        }
        throw ExcepcionApi.credencialesInvalidas();
    }

    public Sesion cambiarClave(UUID idUsuario, String claveActual, String claveNueva, String ip) {
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
        auditoria.registrar(EventoAcceso.CAMBIO_CLAVE, usuario.id(), usuario.nombreUsuario(), ip);

        Usuario actualizado = usuarios.buscarPorId(idUsuario).orElseThrow(ExcepcionApi::credencialesInvalidas);
        return new Sesion(emisor.emitir(actualizado), actualizado);
    }

    public Usuario usuario(UUID idUsuario) {
        return usuarios.buscarPorId(idUsuario).orElseThrow(ExcepcionApi::credencialesInvalidas);
    }

    public record Sesion(TokenEmitido token, Usuario usuario) {
    }
}
