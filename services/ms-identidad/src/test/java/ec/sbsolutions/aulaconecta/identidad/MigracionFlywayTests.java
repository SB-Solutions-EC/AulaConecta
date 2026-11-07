package ec.sbsolutions.aulaconecta.identidad;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest
class MigracionFlywayTests extends PruebaIntegracion {

    private static final String INSERTAR_AUDITORIA =
            "INSERT INTO auditoria_acceso (nombre_usuario_intentado, evento) VALUES ('prueba', 'LOGIN_FALLIDO')";

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void creaLasTablasDelModelo() {
        List<String> tablas = jdbc.queryForList("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name <> 'flyway_schema_history'
                """, String.class);

        assertThat(tablas).containsExactlyInAnyOrder("usuario", "rol", "usuario_rol", "sesion",
                "auditoria_acceso", "cliente_servicio", "clave_firma");
    }

    @Test
    void cargaLosCincoRoles() {
        assertThat(jdbc.queryForList("SELECT codigo FROM rol", String.class))
                .containsExactlyInAnyOrder("ADMIN", "SECRETARIA", "DOCENTE", "ESTUDIANTE", "REPRESENTANTE");
    }

    @Test
    void unUsuarioNuevoDebeCambiarSuClaveInicial() {
        Boolean debeCambiar = jdbc.queryForObject("""
                INSERT INTO usuario (nombre_usuario, hash_clave) VALUES ('ana.perez', 'hash-de-prueba')
                RETURNING debe_cambiar_clave
                """, Boolean.class);

        assertThat(debeCambiar).isTrue();
    }

    @Test
    void rechazaUnEstadoDeUsuarioInvalido() {
        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO usuario (nombre_usuario, hash_clave, estado) VALUES ('luis.lopez', 'hash', 'OTRO')
                """)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void laAuditoriaAdmiteInsercionesPeroNoCambios() {
        assertThat(jdbc.update(INSERTAR_AUDITORIA)).isEqualTo(1);

        assertThatThrownBy(() -> jdbc.update("UPDATE auditoria_acceso SET evento = 'LOGOUT'"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("solo admite inserciones");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM auditoria_acceso"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("solo admite inserciones");
        assertThatThrownBy(() -> jdbc.execute("TRUNCATE auditoria_acceso"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("solo admite inserciones");
    }
}
