package ec.sbsolutions.aulaconecta.identidad.auditoria;

/** Eventos de AUDITORIA_ACCESO; los mismos valores que admite la restricción CHECK de la tabla. */
public enum EventoAcceso {
    LOGIN_OK,
    LOGIN_FALLIDO,
    BLOQUEO,
    DESBLOQUEO,
    CAMBIO_CLAVE,
    LOGOUT,
    ROL_ASIGNADO,
    ROL_RETIRADO
}
