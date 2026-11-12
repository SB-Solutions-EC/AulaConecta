package ec.sbsolutions.aulaconecta.identidad.servicio;

import ec.sbsolutions.aulaconecta.identidad.servicio.ServicioTokensServicio.TokenServicio;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Token de servicio del contrato openapi/ms-identidad.yaml (tag "Servicio a Servicio"). */
@RestController
public class TokenServicioController {

    private final ServicioTokensServicio servicio;

    public TokenServicioController(ServicioTokensServicio servicio) {
        this.servicio = servicio;
    }

    @PostMapping("/oauth/token")
    public ResponseEntity<RespuestaTokenServicio> emitir(@Valid @RequestBody SolicitudTokenServicio solicitud,
            HttpServletRequest peticion) {
        TokenServicio emitido = servicio.emitir(solicitud.clientId(), solicitud.clientSecret(), solicitud.scope(),
                peticion.getRemoteAddr());
        // RFC 6749 §5.1: la respuesta con un token no se guarda en ninguna caché
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache")
                .body(new RespuestaTokenServicio(emitido.token().valor(), "Bearer",
                        emitido.token().segundosDeVida(), emitido.alcances()));
    }

    public record SolicitudTokenServicio(
            @NotBlank @Pattern(regexp = "client_credentials", message = "solo se admite client_credentials") String grantType,
            @NotBlank @Pattern(regexp = "[a-z0-9-]{1,100}") String clientId,
            @NotBlank @Size(max = 200) String clientSecret,
            @Size(max = 300) @Pattern(regexp = "[a-z_: ]*") String scope) {
    }

    public record RespuestaTokenServicio(String accessToken, String tokenType, long expiresIn, String scope) {
    }
}
