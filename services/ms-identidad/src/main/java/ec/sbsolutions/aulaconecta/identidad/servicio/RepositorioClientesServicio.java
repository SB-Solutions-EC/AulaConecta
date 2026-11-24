package ec.sbsolutions.aulaconecta.identidad.servicio;

import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RepositorioClientesServicio {

    private final JdbcClient jdbc;

    public RepositorioClientesServicio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<ClienteServicio> buscar(String clientId) {
        return jdbc.sql("SELECT id, client_id, hash_secreto, alcances, activo FROM cliente_servicio WHERE client_id = :cliente")
                .param("cliente", clientId)
                .query((fila, numero) -> new ClienteServicio(
                        fila.getObject("id", UUID.class),
                        fila.getString("client_id"),
                        fila.getString("hash_secreto"),
                        Arrays.stream(fila.getString("alcances").split(" "))
                                .filter(alcance -> !alcance.isBlank())
                                .collect(Collectors.toCollection(LinkedHashSet::new)),
                        fila.getBoolean("activo")))
                .optional();
    }

    /** Crea el cliente o actualiza su hash y alcances; queda activo. */
    public void registrar(String clientId, String hashSecreto, Collection<String> alcances) {
        jdbc.sql("""
                INSERT INTO cliente_servicio (client_id, hash_secreto, alcances, activo)
                VALUES (:cliente, :hash, :alcances, TRUE)
                ON CONFLICT (client_id) DO UPDATE
                SET hash_secreto = EXCLUDED.hash_secreto, alcances = EXCLUDED.alcances, activo = TRUE
                """)
                .param("cliente", clientId)
                .param("hash", hashSecreto)
                .param("alcances", String.join(" ", alcances))
                .update();
    }

    /** Desactiva los clientes que ya no están en la configuración: dejan de recibir tokens. */
    public int desactivarExcepto(Collection<String> vigentes) {
        if (vigentes.isEmpty()) {
            return jdbc.sql("UPDATE cliente_servicio SET activo = FALSE WHERE activo").update();
        }
        return jdbc.sql("UPDATE cliente_servicio SET activo = FALSE WHERE activo AND client_id NOT IN (:vigentes)")
                .param("vigentes", vigentes)
                .update();
    }
}
