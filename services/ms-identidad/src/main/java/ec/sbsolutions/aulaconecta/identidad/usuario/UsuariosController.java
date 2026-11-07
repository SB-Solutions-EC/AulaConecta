package ec.sbsolutions.aulaconecta.identidad.usuario;

import ec.sbsolutions.aulaconecta.identidad.autenticacion.UsuarioIdentidad;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Alta y desbloqueo de cuentas. Solo para el administrador: ver ConfiguracionSeguridad. */
@RestController
@RequestMapping("/usuarios")
public class UsuariosController {

    private final ServicioUsuarios servicio;

    public UsuariosController(ServicioUsuarios servicio) {
        this.servicio = servicio;
    }

    @PostMapping
    public ResponseEntity<UsuarioIdentidad> crear(@AuthenticationPrincipal Jwt token,
            @Valid @RequestBody SolicitudCrearUsuario solicitud, HttpServletRequest peticion) {
        Usuario usuario = servicio.crear(solicitud.id(), solicitud.nombres(), solicitud.apellidos(),
                solicitud.cedulaInicial(), solicitud.roles(), UUID.fromString(token.getSubject()),
                peticion.getRemoteAddr());
        return ResponseEntity.created(URI.create("/usuarios/" + usuario.id())).body(UsuarioIdentidad.de(usuario));
    }

    @PostMapping("/{id}/desbloquear")
    public UsuarioIdentidad desbloquear(@AuthenticationPrincipal Jwt token, @PathVariable UUID id,
            @Valid @RequestBody(required = false) SolicitudDesbloqueo solicitud, HttpServletRequest peticion) {
        SolicitudDesbloqueo datos = solicitud != null ? solicitud : new SolicitudDesbloqueo(false, null);
        return UsuarioIdentidad.de(servicio.desbloquear(id, Boolean.TRUE.equals(datos.restablecerClaveInicial()),
                datos.cedulaInicial(), UUID.fromString(token.getSubject()), peticion.getRemoteAddr()));
    }

    public record SolicitudCrearUsuario(
            UUID id,
            @NotBlank @Size(max = 100) String nombres,
            @NotBlank @Size(max = 100) String apellidos,
            @NotBlank @Pattern(regexp = "[A-Za-z0-9]{6,20}") String cedulaInicial,
            @NotEmpty List<@NotNull CodigoRol> roles) {
    }

    public record SolicitudDesbloqueo(
            Boolean restablecerClaveInicial,
            @Pattern(regexp = "[A-Za-z0-9]{6,20}") String cedulaInicial) {
    }
}
