package ec.sbsolutions.aulaconecta.identidad.usuario;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class GeneradorNombreUsuarioTests {

    @ParameterizedTest(name = "{0} + {1} -> {2}")
    @CsvSource({
            "Ana Carla,           Pérez Mora,          ana.perez",
            "  Mateo  ,           Rojas,               mateo.rojas",
            "Iñaki,               Núñez Ruiz,          inaki.nunez",
            "José-Luis,           Ibarra León,         jose.ibarra",
            "Camila,              De la Torre Mora,    camila.delatorre",
            "Diego,               del Salto,           diego.delsalto",
            "Ana,                 O'Brien,             ana.obrien",
            "ANA,                 PÉREZ,               ana.perez"
    })
    void generaNombreApellidoSinTildesNiSimbolos(String nombres, String apellidos, String esperado) {
        assertThat(GeneradorNombreUsuario.base(nombres, apellidos)).isEqualTo(esperado);
    }

    @Test
    void sinLetrasUtilizablesNoGeneraNombre() {
        assertThat(GeneradorNombreUsuario.base("123", "Pérez")).isNull();
        assertThat(GeneradorNombreUsuario.base("Ana", "   ")).isNull();
        assertThat(GeneradorNombreUsuario.base(null, "Pérez")).isNull();
    }

    @Test
    void recortaNombresMuyLargosParaQueQuepaElSufijo() {
        String base = GeneradorNombreUsuario.base("a".repeat(80), "b".repeat(80));

        assertThat(base).hasSize(90);
    }

    @Test
    void siElNombreEstaLibreLoUsaTalCual() {
        assertThat(GeneradorNombreUsuario.siguienteDisponible("ana.perez", List.of())).isEqualTo("ana.perez");
        assertThat(GeneradorNombreUsuario.siguienteDisponible("ana.perez", List.of("ana.perezmora"))).isEqualTo("ana.perez");
    }

    @Test
    void siYaExisteAgregaElSiguienteNumero() {
        assertThat(GeneradorNombreUsuario.siguienteDisponible("ana.perez", List.of("ana.perez"))).isEqualTo("ana.perez2");
        assertThat(GeneradorNombreUsuario.siguienteDisponible("ana.perez",
                List.of("ana.perez", "ana.perez2", "ana.perez7", "ana.perezmora"))).isEqualTo("ana.perez8");
    }
}
