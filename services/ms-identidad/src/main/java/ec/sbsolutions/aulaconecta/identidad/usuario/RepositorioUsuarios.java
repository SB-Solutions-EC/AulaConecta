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

    /** No cambia la versión: el último acceso no es un cambio de datos que deba sincronizarse. */
    public void registrarAcceso(UUID id) {
        jdbc.sql("UPDATE usuario SET ultimo_acceso = now() WHERE id = :id").param("id", id).update();
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
                SET hash_clave = :hash, debe_cambiar_clave = FALSE, version = version + 1,
                    actualizado_en = now(), actualizado_por = :id
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
                roles(fila.getArray("roles")));
    }

    private static Instant instante(Timestamp momento) {
        return momento == null ? null : momento.toInstant();
    }

    private static List<String> roles(Array arreglo) throws SQLException {
        return Arrays.asList((String[]) arreglo.getArray());
    }
}
