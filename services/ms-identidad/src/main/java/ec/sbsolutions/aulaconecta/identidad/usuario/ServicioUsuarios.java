package ec.sbsolutions.aulaconecta.identidad.usuario;

import ec.sbsolutions.aulaconecta.identidad.auditoria.EventoAcceso;
import ec.sbsolutions.aulaconecta.identidad.auditoria.RepositorioAuditoria;
import ec.sbsolutions.aulaconecta.identidad.error.ExcepcionApi;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ServicioUsuarios {

    private final RepositorioUsuarios usuarios;
    private final RepositorioAuditoria auditoria;
    private final PasswordEncoder codificador;
    private final GeneradorClaveTemporal generador;
    private final PropiedadesClaveTemporal claveTemporal;

    public ServicioUsuarios(RepositorioUsuarios usuarios, RepositorioAuditoria auditoria, PasswordEncoder codificador,
            GeneradorClaveTemporal generador, PropiedadesClaveTemporal claveTemporal) {
        this.usuarios = usuarios;
        this.auditoria = auditoria;
        this.codificador = codificador;
        this.generador = generador;
        this.claveTemporal = claveTemporal;
    }

    /** La cuenta y, solo en esta respuesta, la clave temporal en claro para entregarla a la persona. */
    public record CuentaConClave(Usuario usuario, String claveTemporal) {
    }

    /**
     * Crea la cuenta con nombre de usuario generado (RF-02) y una clave temporal aleatoria de un solo uso que
     * vence a las 72 horas (RF-03 v1.1). Los nombres solo se usan para el nombre de usuario: db_identidad guarda
     * ese nombre y el hash de la clave, nunca datos personales. La cédula ya no se recibe (CR-02).
     */
    @Transactional
    public CuentaConClave crear(UUID idSolicitado, String nombres, String apellidos, List<CodigoRol> roles,
            UUID creadoPor, String ip) {
        String base = GeneradorNombreUsuario.base(nombres, apellidos);
        if (base == null) {
            throw ExcepcionApi.solicitudInvalida("NOMBRE_INVALIDO",
                    "Los nombres y apellidos deben tener al menos una letra para generar el nombre de usuario");
        }
        UUID id = idSolicitado != null ? idSolicitado : UUID.randomUUID();
        if (usuarios.existe(id)) {
            throw ExcepcionApi.conflicto("USUARIO_EXISTENTE", "Ya existe una cuenta con ese identificador");
        }

        usuarios.reservarNombre(base);
        String nombreUsuario = GeneradorNombreUsuario.siguienteDisponible(base, usuarios.nombresQueEmpiezanCon(base));
        String clave = generador.generar();
        usuarios.insertar(id, nombreUsuario, codificador.encode(clave), vencimiento(), creadoPor);
        for (CodigoRol rol : new LinkedHashSet<>(roles)) {
            usuarios.asignarRol(id, rol, creadoPor);
            auditoria.registrar(EventoAcceso.ROL_ASIGNADO, id, nombreUsuario, ip);
        }
        auditoria.registrar(EventoAcceso.CLAVE_TEMPORAL, id, nombreUsuario, ip);
        return new CuentaConClave(usuarios.buscarPorId(id).orElseThrow(), clave);
    }

    /**
     * Entrega otra clave temporal cuando la anterior venció, ya se usó o la persona olvidó su clave (RN-13).
     * No levanta un bloqueo: eso lo decide el administrador con el desbloqueo.
     */
    @Transactional
    public CuentaConClave generarClaveTemporal(UUID id, UUID responsable, String ip) {
        Usuario usuario = existente(id);
        String clave = generador.generar();
        if (!usuarios.asignarClaveTemporal(id, codificador.encode(clave), vencimiento(), responsable)) {
            throw ExcepcionApi.conflictoVersion();
        }
        auditoria.registrar(EventoAcceso.CLAVE_TEMPORAL, id, usuario.nombreUsuario(), ip);
        return new CuentaConClave(usuarios.buscarPorId(id).orElseThrow(), clave);
    }

    /** Levanta el bloqueo; opcionalmente entrega una clave temporal nueva, que la persona deberá cambiar. */
    @Transactional
    public CuentaConClave desbloquear(UUID id, boolean restablecerClave, UUID administrador, String ip) {
        Usuario usuario = existente(id);
        String clave = restablecerClave ? generador.generar() : null;
        if (!usuarios.desbloquear(id, clave == null ? null : codificador.encode(clave), vencimiento(), administrador)) {
            throw ExcepcionApi.conflictoVersion();
        }
        auditoria.registrar(EventoAcceso.DESBLOQUEO, id, usuario.nombreUsuario(), ip);
        if (clave != null) {
            auditoria.registrar(EventoAcceso.CLAVE_TEMPORAL, id, usuario.nombreUsuario(), ip);
        }
        return new CuentaConClave(usuarios.buscarPorId(id).orElseThrow(), clave);
    }

    private Usuario existente(UUID id) {
        Usuario usuario = usuarios.buscarPorId(id).orElseThrow(
                () -> ExcepcionApi.noEncontrado("USUARIO_NO_ENCONTRADO", "No existe una cuenta con ese identificador"));
        if (usuario.estaInactiva()) {
            throw ExcepcionApi.conflicto("CUENTA_INACTIVA", "La cuenta está inactiva: hay que reactivarla primero");
        }
        return usuario;
    }

    private Instant vencimiento() {
        return Instant.now().plus(claveTemporal.vigencia());
    }
}
