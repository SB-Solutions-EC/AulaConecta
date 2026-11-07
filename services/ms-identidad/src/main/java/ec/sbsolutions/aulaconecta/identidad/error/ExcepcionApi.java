package ec.sbsolutions.aulaconecta.identidad.error;

import org.springframework.http.HttpStatus;

/** Error con su código del contrato (ErrorApi) y el estado HTTP que le corresponde. */
public class ExcepcionApi extends RuntimeException {

    private final HttpStatus estado;
    private final String codigo;

    private ExcepcionApi(HttpStatus estado, String codigo, String mensaje) {
        super(mensaje);
        this.estado = estado;
        this.codigo = codigo;
    }

    /** El mismo mensaje para usuario inexistente, clave incorrecta o cuenta inactiva. */
    public static ExcepcionApi credencialesInvalidas() {
        return new ExcepcionApi(HttpStatus.UNAUTHORIZED, "CREDENCIALES_INVALIDAS", "Usuario o contraseña incorrectos");
    }

    public static ExcepcionApi cuentaBloqueada() {
        return new ExcepcionApi(HttpStatus.LOCKED, "CUENTA_BLOQUEADA",
                "La cuenta está bloqueada temporalmente; intenta más tarde o pide el desbloqueo al administrador");
    }

    public static ExcepcionApi solicitudInvalida(String codigo, String mensaje) {
        return new ExcepcionApi(HttpStatus.BAD_REQUEST, codigo, mensaje);
    }

    public static ExcepcionApi conflictoVersion() {
        return new ExcepcionApi(HttpStatus.CONFLICT, "CONFLICTO_VERSION",
                "La cuenta cambió mientras se procesaba la solicitud; vuelve a intentarlo");
    }

    public HttpStatus estado() {
        return estado;
    }

    public String codigo() {
        return codigo;
    }
}
