package ec.sbsolutions.aulaconecta.identidad.usuario;

import ec.sbsolutions.aulaconecta.identidad.auditoria.EventoAcceso;
import ec.sbsolutions.aulaconecta.identidad.auditoria.RepositorioAuditoria;
import ec.sbsolutions.aulaconecta.identidad.error.ExcepcionApi;
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

    public ServicioUsuarios(RepositorioUsuarios usuarios, RepositorioAuditoria auditoria, PasswordEncoder codificador) {
        this.usuarios = usuarios;
        this.auditoria = auditoria;
        this.codificador = codificador;
    }

    /**
     * Crea la cuenta con nombre de usuario generado (RF-02) y la cédula como clave inicial (RF-03). Los nombres y
     * la cédula solo se usan aquí: db_identidad guarda el nombre de usuario y el hash, nunca los datos personales.
     */
    @Transactional
    public Usuario crear(UUID idSolicitado, String nombres, String apellidos, String cedulaInicial,
            List<CodigoRol> roles, UUID creadoPor, String ip) {
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
        usuarios.insertar(id, nombreUsuario, codificador.encode(cedulaInicial), creadoPor);
        for (CodigoRol rol : new LinkedHashSet<>(roles)) {
            usuarios.asignarRol(id, rol, creadoPor);
            auditoria.registrar(EventoAcceso.ROL_ASIGNADO, id, nombreUsuario, ip);
        }
        return usuarios.buscarPorId(id).orElseThrow();
    }

    /** Levanta el bloqueo; opcionalmente restablece la clave inicial, que el usuario deberá cambiar otra vez. */
    @Transactional
    public Usuario desbloquear(UUID id, boolean restablecerClaveInicial, String cedulaInicial, UUID administrador,
            String ip) {
        Usuario usuario = usuarios.buscarPorId(id).orElseThrow(
                () -> ExcepcionApi.noEncontrado("USUARIO_NO_ENCONTRADO", "No existe una cuenta con ese identificador"));
        if (usuario.estaInactiva()) {
            throw ExcepcionApi.conflicto("CUENTA_INACTIVA", "La cuenta está inactiva: hay que reactivarla, no desbloquearla");
        }
        if (restablecerClaveInicial && (cedulaInicial == null || cedulaInicial.isBlank())) {
            throw ExcepcionApi.solicitudInvalida("CEDULA_REQUERIDA", "Para restablecer la clave inicial se necesita la cédula");
        }

        String hash = restablecerClaveInicial ? codificador.encode(cedulaInicial) : null;
        if (!usuarios.desbloquear(id, hash, administrador)) {
            throw ExcepcionApi.conflictoVersion();
        }
        auditoria.registrar(EventoAcceso.DESBLOQUEO, id, usuario.nombreUsuario(), ip);
        return usuarios.buscarPorId(id).orElseThrow();
    }
}
