package ec.sbsolutions.aulaconecta.identidad.servicio;

import ec.sbsolutions.aulaconecta.identidad.auditoria.EventoAcceso;
import ec.sbsolutions.aulaconecta.identidad.auditoria.RepositorioAuditoria;
import ec.sbsolutions.aulaconecta.identidad.error.ExcepcionApi;
import ec.sbsolutions.aulaconecta.identidad.seguridad.EmisorTokens;
import ec.sbsolutions.aulaconecta.identidad.seguridad.EmisorTokens.TokenEmitido;
import java.util.Arrays;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Client credentials (contrato: POST /oauth/token): autentica al servicio y emite su token de corta duración. */
@Service
public class ServicioTokensServicio {

    // Si el cliente no existe se compara igual contra esta huella, para tardar lo mismo que con uno real
    private static final ClienteServicio INEXISTENTE = new ClienteServicio(new UUID(0, 0), "",
            ClienteServicio.huella(UUID.randomUUID().toString()), Set.of(), false);

    private final RepositorioClientesServicio clientes;
    private final RepositorioAuditoria auditoria;
    private final EmisorTokens emisor;
    private final PropiedadesClientesServicio propiedades;

    public ServicioTokensServicio(RepositorioClientesServicio clientes, RepositorioAuditoria auditoria,
            EmisorTokens emisor, PropiedadesClientesServicio propiedades) {
        this.clientes = clientes;
        this.auditoria = auditoria;
        this.emisor = emisor;
        this.propiedades = propiedades;
    }

    /**
     * @param alcanceSolicitado alcances separados por espacios; vacío pide todos los del cliente
     */
    public TokenServicio emitir(String clientId, String secreto, String alcanceSolicitado, String ip) {
        Optional<ClienteServicio> encontrado = clientes.buscar(clientId);
        ClienteServicio cliente = encontrado.orElse(INEXISTENTE);
        boolean secretoValido = cliente.secretoCoincide(secreto);
        if (encontrado.isEmpty() || !cliente.activo() || !secretoValido) {
            auditoria.registrar(EventoAcceso.TOKEN_SERVICIO_FALLIDO, null, clientId, ip);
            throw ExcepcionApi.clienteInvalido();
        }

        Set<String> alcances = alcancesConcedidos(cliente, alcanceSolicitado);
        if (alcances.isEmpty()) {
            auditoria.registrar(EventoAcceso.TOKEN_SERVICIO_FALLIDO, null, clientId, ip);
            throw ExcepcionApi.solicitudInvalida("ALCANCE_INVALIDO",
                    "El servicio no tiene autorizado alguno de los alcances solicitados");
        }
        TokenEmitido token = emisor.emitirServicio(cliente, alcances, propiedades.duracionToken());
        auditoria.registrar(EventoAcceso.TOKEN_SERVICIO, null, clientId, ip);
        return new TokenServicio(token, String.join(" ", alcances));
    }

    /** Todos los del cliente, o los pedidos si todos están autorizados; si no, ninguno. */
    private static Set<String> alcancesConcedidos(ClienteServicio cliente, String alcanceSolicitado) {
        if (alcanceSolicitado == null || alcanceSolicitado.isBlank()) {
            return new TreeSet<>(cliente.alcances());
        }
        Set<String> pedidos = Arrays.stream(alcanceSolicitado.trim().split("\\s+"))
                .collect(Collectors.toCollection(TreeSet::new));
        return cliente.alcances().containsAll(pedidos) ? pedidos : Set.of();
    }

    public record TokenServicio(TokenEmitido token, String alcances) {
    }
}
