package ec.sbsolutions.aulaconecta.identidad.servicio;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Al iniciar, deja la tabla cliente_servicio igual a la configuración: registra (o rota) el hash de cada
 * cliente configurado y desactiva los demás. Así dar de baja un servicio es quitarlo de la configuración.
 */
@Component
public class RegistroClientesServicio implements ApplicationRunner {

    private static final Logger REGISTRO = LoggerFactory.getLogger(RegistroClientesServicio.class);
    // El client_id forma el nombre del archivo: sin barras ni puntos, no puede salir del directorio
    private static final Pattern CLIENT_ID = Pattern.compile("[a-z0-9-]{1,100}");
    private static final Pattern ALCANCE = Pattern.compile("[a-z_]+:[a-z_]+");
    private static final Pattern SHA256_HEX = Pattern.compile("[0-9a-f]{64}");

    private final PropiedadesClientesServicio propiedades;
    private final RepositorioClientesServicio repositorio;

    public RegistroClientesServicio(PropiedadesClientesServicio propiedades, RepositorioClientesServicio repositorio) {
        this.propiedades = propiedades;
        this.repositorio = repositorio;
    }

    @Override
    public void run(ApplicationArguments argumentos) {
        String directorio = propiedades.directorioHashes();
        if (directorio == null || directorio.isBlank()) {
            REGISTRO.info("Sin directorio de hashes: no se registran clientes de servicio");
            return;
        }
        registrar(Path.of(directorio));
    }

    /** Devuelve los client_id registrados. */
    public List<String> registrar(Path directorio) {
        List<String> registrados = new ArrayList<>();
        for (Map.Entry<String, String> cliente : new TreeMap<>(propiedades.alcances()).entrySet()) {
            String clientId = cliente.getKey();
            List<String> alcances = Arrays.stream(cliente.getValue().trim().split("\\s+")).distinct().toList();
            if (!CLIENT_ID.matcher(clientId).matches() || !alcances.stream().allMatch(a -> ALCANCE.matcher(a).matches())) {
                throw new IllegalStateException("Cliente de servicio mal configurado: " + clientId);
            }
            Path archivo = directorio.resolve(clientId + ".sha256");
            if (!Files.isReadable(archivo)) {
                REGISTRO.warn("No hay hash para el cliente de servicio {}: no podrá pedir tokens", clientId);
                continue;
            }
            String hash = leer(archivo).trim().toLowerCase(Locale.ROOT);
            if (!SHA256_HEX.matcher(hash).matches()) {
                throw new IllegalStateException("El hash del cliente " + clientId + " no es un SHA-256 en hexadecimal");
            }
            repositorio.registrar(clientId, ClienteServicio.PREFIJO_HASH + hash, alcances);
            registrados.add(clientId);
        }
        int desactivados = repositorio.desactivarExcepto(registrados);
        REGISTRO.info("Clientes de servicio activos: {}; desactivados: {}", registrados, desactivados);
        return registrados;
    }

    private static String leer(Path archivo) {
        try {
            return Files.readString(archivo);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
