package ec.sbsolutions.aulaconecta.identidad.autenticacion;

import ec.sbsolutions.aulaconecta.identidad.seguridad.ClaveFirma;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Claves públicas para que ms-academico y ms-notificaciones validen los tokens sin llamar a este servicio. */
@RestController
public class JwksController {

    private final ClaveFirma clave;

    public JwksController(ClaveFirma clave) {
        this.clave = clave;
    }

    @GetMapping("/.well-known/jwks.json")
    public ResponseEntity<Map<String, Object>> jwks() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .body(clave.conjuntoPublico().toJSONObject());
    }
}
