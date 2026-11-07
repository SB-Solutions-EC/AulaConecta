package ec.sbsolutions.aulaconecta.identidad.error;

import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Convierte los errores al formato ErrorApi del contrato, sin detalles internos. */
@RestControllerAdvice
public class ManejadorErrores {

    @ExceptionHandler(ExcepcionApi.class)
    ResponseEntity<ErrorApi> errorApi(ExcepcionApi error) {
        return ResponseEntity.status(error.estado()).body(new ErrorApi(error.codigo(), error.getMessage(), List.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorApi> datosInvalidos(MethodArgumentNotValidException error) {
        List<String> detalles = error.getBindingResult().getFieldErrors().stream()
                .map(campo -> campo.getField() + ": " + campo.getDefaultMessage())
                .sorted()
                .toList();
        return ResponseEntity.badRequest().body(new ErrorApi("DATOS_INVALIDOS", "Revisa los datos enviados", detalles));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorApi> cuerpoIlegible() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErrorApi("DATOS_INVALIDOS", "El cuerpo de la solicitud no es un JSON válido", List.of()));
    }

    public record ErrorApi(String codigo, String mensaje, List<String> detalles, Instant timestamp) {

        ErrorApi(String codigo, String mensaje, List<String> detalles) {
            this(codigo, mensaje, detalles, Instant.now());
        }
    }
}
