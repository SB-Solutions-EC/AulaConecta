package ec.sbsolutions.aulaconecta.identidad.auditoria;

import ec.sbsolutions.aulaconecta.identidad.auditoria.RepositorioAuditoria.RegistroAuditoriaAcceso;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Consulta de la bitácora de accesos (RNF-09, RNF-12). Solo para el administrador: ver ConfiguracionSeguridad. */
@RestController
public class AuditoriaController {

    private final RepositorioAuditoria auditoria;

    public AuditoriaController(RepositorioAuditoria auditoria) {
        this.auditoria = auditoria;
    }

    @GetMapping("/auditoria-accesos")
    public List<RegistroAuditoriaAcceso> listar(
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam(required = false) EventoAcceso evento,
            @RequestParam(required = false) Instant desde,
            @RequestParam(required = false) Instant hasta,
            @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limite) {
        return auditoria.buscar(usuarioId, evento, desde, hasta, limite);
    }
}
