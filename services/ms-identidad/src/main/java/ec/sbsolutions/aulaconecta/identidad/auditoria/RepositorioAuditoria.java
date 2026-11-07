package ec.sbsolutions.aulaconecta.identidad.auditoria;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Bitácora de accesos: solo inserta y consulta. La tabla rechaza cambios y borrados con un trigger (V1). */
@Repository
public class RepositorioAuditoria {

    private static final Pattern IP = Pattern.compile("[0-9A-Fa-f:.]{2,45}");
    private static final int LONGITUD_NOMBRE = 100;

    private final JdbcClient jdbc;

    public RepositorioAuditoria(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void registrar(EventoAcceso evento, UUID usuarioId, String nombreUsuarioIntentado, String ip) {
        jdbc.sql("""
                INSERT INTO auditoria_acceso (usuario_id, nombre_usuario_intentado, evento, ip)
                VALUES (:usuario, :nombre, :evento, CAST(:ip AS inet))
                """)
                .param("usuario", usuarioId)
                .param("nombre", recortar(nombreUsuarioIntentado))
                .param("evento", evento.name())
                .param("ip", ipValida(ip))
                .update();
    }

    public List<RegistroAuditoriaAcceso> buscar(UUID usuarioId, EventoAcceso evento, Instant desde, Instant hasta,
            int limite) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, usuario_id, nombre_usuario_intentado, evento, host(ip) AS ip, ocurrido_en
                FROM auditoria_acceso WHERE TRUE
                """);
        Map<String, Object> parametros = new HashMap<>();
        parametros.put("limite", limite);
        if (usuarioId != null) {
            sql.append(" AND usuario_id = :usuario");
            parametros.put("usuario", usuarioId);
        }
        if (evento != null) {
            sql.append(" AND evento = :evento");
            parametros.put("evento", evento.name());
        }
        if (desde != null) {
            sql.append(" AND ocurrido_en >= :desde");
            parametros.put("desde", Timestamp.from(desde));
        }
        if (hasta != null) {
            sql.append(" AND ocurrido_en <= :hasta");
            parametros.put("hasta", Timestamp.from(hasta));
        }
        sql.append(" ORDER BY ocurrido_en DESC, id LIMIT :limite");

        return jdbc.sql(sql.toString()).params(parametros).query((fila, numero) -> new RegistroAuditoriaAcceso(
                fila.getObject("id", UUID.class),
                fila.getObject("usuario_id", UUID.class),
                fila.getString("nombre_usuario_intentado"),
                EventoAcceso.valueOf(fila.getString("evento")),
                fila.getString("ip"),
                fila.getTimestamp("ocurrido_en").toInstant()))
                .list();
    }

    /** La IP llega del contenedor web; si no tiene forma de IP, se guarda vacía en vez de fallar el registro. */
    private static String ipValida(String ip) {
        return ip != null && IP.matcher(ip).matches() ? ip : null;
    }

    private static String recortar(String nombre) {
        return nombre == null || nombre.length() <= LONGITUD_NOMBRE ? nombre : nombre.substring(0, LONGITUD_NOMBRE);
    }

    public record RegistroAuditoriaAcceso(
            UUID id, UUID usuarioId, String nombreUsuarioIntentado, EventoAcceso evento, String ip, Instant ocurridoEn) {
    }
}
