package ec.sbsolutions.aulaconecta.identidad.usuario;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import ec.sbsolutions.aulaconecta.identidad.autenticacion.UsuarioIdentidad;
import ec.sbsolutions.aulaconecta.identidad.usuario.ServicioUsuarios.CuentaConClave;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Alta, desbloqueo y clave temporal de las cuentas. Quién puede usar cada uno: ver ConfiguracionSeguridad. */
@RestController
@RequestMapping("/usuarios")
public class UsuariosController {

    private final ServicioUsuarios servicio;

    public UsuariosController(ServicioUsuarios servicio) {
        this.servicio = servicio;
    }

    @PostMapping
    public ResponseEntity<CuentaConClaveTemporal> crear(@AuthenticationPrincipal Jwt token,
            @Valid @RequestBody SolicitudCrearUsuario solicitud, HttpServletRequest peticion) {
        CuentaConClave cuenta = servicio.crear(solicitud.id(), solicitud.nombres(), solicitud.apellidos(),
                solicitud.roles(), UUID.fromString(token.getSubject()), peticion.getRemoteAddr());
        return ResponseEntity.created(URI.create("/usuarios/" + cuenta.usuario().id()))
                .cacheControl(CacheControl.noStore())
                .body(CuentaConClaveTemporal.de(cuenta));
    }

    /** Otra clave temporal: la anterior venció, ya se usó o la persona olvidó su clave (RN-13). */
    @PostMapping("/{id}/clave-temporal")
    public ResponseEntity<CuentaConClaveTemporal> claveTemporal(@AuthenticationPrincipal Jwt token, @PathVariable UUID id,
            HttpServletRequest peticion) {
        CuentaConClave cuenta = servicio.generarClaveTemporal(id, UUID.fromString(token.getSubject()),
                peticion.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(CuentaConClaveTemporal.de(cuenta));
    }

    @PostMapping("/{id}/desbloquear")
    public ResponseEntity<CuentaConClaveTemporal> desbloquear(@AuthenticationPrincipal Jwt token, @PathVariable UUID id,
            @Valid @RequestBody(required = false) SolicitudDesbloqueo solicitud, HttpServletRequest peticion) {
        boolean restablecer = solicitud != null && Boolean.TRUE.equals(solicitud.restablecerClaveInicial());
        CuentaConClave cuenta = servicio.desbloquear(id, restablecer, UUID.fromString(token.getSubject()),
                peticion.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(CuentaConClaveTemporal.de(cuenta));
    }

    // Ya no lleva cédula (CR-02): si un cliente antiguo la manda, se ignora y nunca llega a guardarse
    public record SolicitudCrearUsuario(
            UUID id,
            @NotBlank @Size(max = 100) String nombres,
            @NotBlank @Size(max = 100) String apellidos,
            @NotEmpty List<@NotNull CodigoRol> roles) {
    }

    public record SolicitudDesbloqueo(Boolean restablecerClaveInicial) {
    }

    /**
     * La cuenta y, cuando se acaba de generar, la clave temporal en claro: es la única vez que sale del servicio.
     * La respuesta lleva Cache-Control: no-store para que ningún intermediario la guarde.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record CuentaConClaveTemporal(@JsonUnwrapped UsuarioIdentidad cuenta, String claveTemporal) {

        static CuentaConClaveTemporal de(CuentaConClave cuenta) {
            return new CuentaConClaveTemporal(UsuarioIdentidad.de(cuenta.usuario()), cuenta.claveTemporal());
        }
    }
}
