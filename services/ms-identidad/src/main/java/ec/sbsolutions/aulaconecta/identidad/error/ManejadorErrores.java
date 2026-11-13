package ec.sbsolutions.aulaconecta.identidad.error;

import java.time.Instant;
import java.util.List;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

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

    /** Parámetros de la URL con restricciones (por ejemplo, el límite de la consulta de auditoría). */
    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ErrorApi> parametrosInvalidos(HandlerMethodValidationException error) {
        List<String> detalles = error.getAllErrors().stream()
                .map(MessageSourceResolvable::getDefaultMessage)
                .sorted()
                .toList();
        return ResponseEntity.badRequest().body(new ErrorApi("DATOS_INVALIDOS", "Revisa los parámetros enviados", detalles));
    }

    /** Un parámetro con el tipo equivocado: un UUID, una fecha o un evento que no existen. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorApi> tipoInvalido(MethodArgumentTypeMismatchException error) {
        return ResponseEntity.badRequest().body(new ErrorApi("DATOS_INVALIDOS", "Revisa los parámetros enviados",
                List.of(error.getName() + ": valor no válido")));
    }

    public record ErrorApi(String codigo, String mensaje, List<String> detalles, Instant timestamp) {

        ErrorApi(String codigo, String mensaje, List<String> detalles) {
            this(codigo, mensaje, detalles, Instant.now());
        }
    }
}
