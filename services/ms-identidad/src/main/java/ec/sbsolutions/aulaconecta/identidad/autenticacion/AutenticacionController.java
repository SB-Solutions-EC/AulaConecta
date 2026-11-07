package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import ec.sbsolutions.aulaconecta.identidad.autenticacion.ServicioAutenticacion.Sesion;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Endpoints de autenticación del contrato openapi/ms-identidad.yaml. */
@RestController
@RequestMapping("/auth")
public class AutenticacionController {

    private final ServicioAutenticacion servicio;

    public AutenticacionController(ServicioAutenticacion servicio) {
        this.servicio = servicio;
    }

    @PostMapping("/login")
    public RespuestaTokenAcceso iniciarSesion(@Valid @RequestBody SolicitudLogin solicitud) {
        return respuesta(servicio.iniciarSesion(solicitud.nombreUsuario(), solicitud.clave()));
    }

    @GetMapping("/me")
    public UsuarioIdentidad perfil(@AuthenticationPrincipal Jwt token) {
        return UsuarioIdentidad.de(servicio.usuario(UUID.fromString(token.getSubject())));
    }

    @PostMapping("/cambiar-clave")
    public RespuestaTokenAcceso cambiarClave(@AuthenticationPrincipal Jwt token,
            @Valid @RequestBody SolicitudCambioClave solicitud) {
        return respuesta(servicio.cambiarClave(UUID.fromString(token.getSubject()),
                solicitud.claveActual(), solicitud.claveNueva()));
    }

    private static RespuestaTokenAcceso respuesta(Sesion sesion) {
        return new RespuestaTokenAcceso(sesion.token().valor(), "Bearer", sesion.token().segundosDeVida(),
                UsuarioIdentidad.de(sesion.usuario()));
    }

    // En el inicio de sesión no se valida la longitud mínima: la clave inicial es la cédula
    public record SolicitudLogin(
            @NotBlank @Size(max = 100) String nombreUsuario,
            @NotBlank @Size(max = 128) String clave) {
    }

    public record SolicitudCambioClave(
            @NotBlank @Size(max = 128) String claveActual,
            @NotBlank @Size(min = 8, max = 128) String claveNueva) {
    }

    public record RespuestaTokenAcceso(String accessToken, String tokenType, long expiresIn, UsuarioIdentidad usuario) {
    }
}
