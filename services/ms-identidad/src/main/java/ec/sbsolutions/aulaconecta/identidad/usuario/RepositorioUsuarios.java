package ec.sbsolutions.aulaconecta.identidad.usuario;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RepositorioUsuarios {

    private static final String SELECCION = """
            SELECT u.id, u.nombre_usuario, u.hash_clave, u.debe_cambiar_clave, u.estado, u.intentos_fallidos,
                   u.bloqueado_hasta, u.ultimo_acceso, u.creado_en, u.actualizado_en, u.actualizado_por, u.version,
                   u.clave_temporal_vence, u.clave_temporal_usada,
                   array_remove(array_agg(r.codigo ORDER BY r.codigo), NULL) AS roles
            FROM usuario u
            LEFT JOIN usuario_rol ur ON ur.usuario_id = u.id
            LEFT JOIN rol r ON r.id = ur.rol_id
            """;

    private final JdbcClient jdbc;

    public RepositorioUsuarios(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Usuario> buscarPorNombre(String nombreUsuario) {
        return jdbc.sql(SELECCION + " WHERE u.nombre_usuario = :nombre GROUP BY u.id")
                .param("nombre", nombreUsuario)
                .query(RepositorioUsuarios::mapear)
                .optional();
    }

    public Optional<Usuario> buscarPorId(UUID id) {
        return jdbc.sql(SELECCION + " WHERE u.id = :id GROUP BY u.id")
                .param("id", id)
                .query(RepositorioUsuarios::mapear)
                .optional();
    }

    // Condición de "no bloqueada ahora": se evalúa en la base, en la misma sentencia que modifica la fila,
    // para que dos intentos simultáneos no puedan saltarse ni deshacer un bloqueo. Empieza con espacio porque se
    // concatena al final de otra sentencia (los bloques de texto quitan los espacios al final de cada línea).
    private static final String NO_BLOQUEADA = " AND estado <> 'INACTIVO'"
            + " AND NOT (estado = 'BLOQUEADO' AND (bloqueado_hasta IS NULL OR bloqueado_hasta > now()))";

    /**
     * Inicio de sesión correcto: reinicia el contador de fallos y levanta un bloqueo ya vencido. Devuelve false
     * si la cuenta quedó bloqueada mientras tanto. No cambia la versión: no es un cambio que deba sincronizarse.
     */
    public boolean registrarAccesoExitoso(UUID id) {
        return jdbc.sql("""
                UPDATE usuario
                SET ultimo_acceso = now(), intentos_fallidos = 0, bloqueado_hasta = NULL,
                    estado = CASE WHEN estado = 'BLOQUEADO' THEN 'ACTIVO' ELSE estado END
                WHERE id = :id""" + NO_BLOQUEADA)
                .param("id", id)
                .update() == 1;
    }

    /**
     * Suma un intento fallido en una sola sentencia y bloquea la cuenta al llegar al máximo. Si el bloqueo
     * anterior ya venció, el conteo empieza de nuevo. Devuelve el estado resultante, o vacío si la cuenta
     * ya estaba bloqueada (en ese caso no se cuenta el intento).
     */
    public Optional<String> registrarFallo(UUID id, int intentosMaximos, long segundosDeBloqueo) {
        return jdbc.sql("""
                UPDATE usuario
                SET intentos_fallidos = CASE WHEN estado = 'BLOQUEADO' THEN 1 ELSE intentos_fallidos + 1 END,
                    estado = CASE WHEN (CASE WHEN estado = 'BLOQUEADO' THEN 1 ELSE intentos_fallidos + 1 END) >= :maximo
                                  THEN 'BLOQUEADO' ELSE 'ACTIVO' END,
                    bloqueado_hasta = CASE WHEN (CASE WHEN estado = 'BLOQUEADO' THEN 1 ELSE intentos_fallidos + 1 END) >= :maximo
                                           THEN now() + make_interval(secs => :segundos) ELSE NULL END
                WHERE id = :id""" + NO_BLOQUEADA + " RETURNING estado")
                .param("id", id)
                .param("maximo", intentosMaximos)
                .param("segundos", segundosDeBloqueo)
                .query(String.class)
                .optional();
    }

    /** Evita que dos altas simultáneas generen el mismo nombre de usuario (se libera al terminar la transacción). */
    public void reservarNombre(String base) {
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtext(:base))").param("base", base).query(Object.class).single();
    }

    public List<String> nombresQueEmpiezanCon(String base) {
        return jdbc.sql("SELECT nombre_usuario FROM usuario WHERE nombre_usuario LIKE :prefijo")
                .param("prefijo", base + "%")
                .query(String.class)
                .list();
    }

    public boolean existe(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM usuario WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }

    /** Cuenta nueva con su clave temporal (RF-03): debe cambiarla en el primer ingreso. */
    public void insertar(UUID id, String nombreUsuario, String hashClaveTemporal, Instant vence, UUID creadoPor) {
        jdbc.sql("""
                INSERT INTO usuario (id, nombre_usuario, hash_clave, debe_cambiar_clave, clave_temporal_vence,
                                     actualizado_por)
                VALUES (:id, :nombre, :hash, TRUE, :vence, :creadoPor)
                """)
                .param("id", id)
                .param("nombre", nombreUsuario)
                .param("hash", hashClaveTemporal)
                .param("vence", Timestamp.from(vence))
                .param("creadoPor", creadoPor)
                .update();
    }

    /**
     * Gasta la clave temporal en un inicio de sesión: solo una vez y antes de que venza. La condición se evalúa
     * en la base en la misma sentencia, así dos inicios simultáneos con la misma clave no pueden entrar los dos.
     */
    public boolean consumirClaveTemporal(UUID id) {
        return jdbc.sql("""
                UPDATE usuario SET clave_temporal_usada = TRUE
                WHERE id = :id AND debe_cambiar_clave AND clave_temporal_vence IS NOT NULL
                  AND NOT clave_temporal_usada AND clave_temporal_vence > now()
                """)
                .param("id", id)
                .update() == 1;
    }

    /** Reemplaza la clave por una temporal nueva (la pide la secretaría o el administrador). */
    public boolean asignarClaveTemporal(UUID id, String hashClaveTemporal, Instant vence, UUID responsable) {
        return jdbc.sql("""
                UPDATE usuario
                SET hash_clave = :hash, debe_cambiar_clave = TRUE, clave_temporal_vence = :vence,
                    clave_temporal_usada = FALSE, version = version + 1, actualizado_en = now(),
                    actualizado_por = :responsable
                WHERE id = :id AND estado <> 'INACTIVO'
                """)
                .param("id", id)
                .param("hash", hashClaveTemporal)
                .param("vence", Timestamp.from(vence))
                .param("responsable", responsable)
                .update() == 1;
    }

    public void asignarRol(UUID usuarioId, CodigoRol rol, UUID asignadoPor) {
        jdbc.sql("""
                INSERT INTO usuario_rol (usuario_id, rol_id, asignado_por)
                SELECT :usuario, id, :asignadoPor FROM rol WHERE codigo = :rol
                """)
                .param("usuario", usuarioId)
                .param("rol", rol.name())
                .param("asignadoPor", asignadoPor)
                .update();
    }

    /** Levanta el bloqueo; si llega un hash, también entrega una clave temporal nueva. Devuelve si se aplicó. */
    public boolean desbloquear(UUID id, String hashClaveTemporal, Instant vence, UUID administrador) {
        String restablecer = hashClaveTemporal == null ? "" : ", hash_clave = :hash, debe_cambiar_clave = TRUE,"
                + " clave_temporal_vence = :vence, clave_temporal_usada = FALSE";
        JdbcClient.StatementSpec sentencia = jdbc.sql("""
                UPDATE usuario
                SET estado = 'ACTIVO', intentos_fallidos = 0, bloqueado_hasta = NULL, version = version + 1,
                    actualizado_en = now(), actualizado_por = :administrador""" + restablecer + """

                WHERE id = :id AND estado <> 'INACTIVO'
                """)
                .param("id", id)
                .param("administrador", administrador);
        if (hashClaveTemporal != null) {
            sentencia = sentencia.param("hash", hashClaveTemporal).param("vence", Timestamp.from(vence));
        }
        return sentencia.update() == 1;
    }

    /** Guarda un hash recalculado con el algoritmo actual (por ejemplo, de BCrypt a Argon2id). */
    public void actualizarHash(UUID id, String hashClave) {
        jdbc.sql("UPDATE usuario SET hash_clave = :hash WHERE id = :id")
                .param("hash", hashClave)
                .param("id", id)
                .update();
    }

    /** Cambia la clave solo si nadie modificó al usuario desde que se leyó; devuelve si se aplicó. */
    public boolean cambiarClave(UUID id, String hashClave, int versionLeida) {
        return jdbc.sql("""
                UPDATE usuario
                SET hash_clave = :hash, debe_cambiar_clave = FALSE, clave_temporal_vence = NULL,
                    clave_temporal_usada = FALSE, version = version + 1, actualizado_en = now(), actualizado_por = :id
                WHERE id = :id AND version = :version
                """)
                .param("hash", hashClave)
                .param("id", id)
                .param("version", versionLeida)
                .update() == 1;
    }

    private static Usuario mapear(ResultSet fila, int numero) throws SQLException {
        return new Usuario(
                fila.getObject("id", UUID.class),
                fila.getString("nombre_usuario"),
                fila.getString("hash_clave"),
                fila.getBoolean("debe_cambiar_clave"),
                fila.getString("estado"),
                fila.getInt("intentos_fallidos"),
                instante(fila.getTimestamp("bloqueado_hasta")),
                instante(fila.getTimestamp("ultimo_acceso")),
                instante(fila.getTimestamp("creado_en")),
                instante(fila.getTimestamp("actualizado_en")),
                fila.getObject("actualizado_por", UUID.class),
                fila.getInt("version"),
                roles(fila.getArray("roles")),
                instante(fila.getTimestamp("clave_temporal_vence")),
                fila.getBoolean("clave_temporal_usada"));
    }

    private static Instant instante(Timestamp momento) {
        return momento == null ? null : momento.toInstant();
    }

    private static List<String> roles(Array arreglo) throws SQLException {
        return Arrays.asList((String[]) arreglo.getArray());
    }
}
