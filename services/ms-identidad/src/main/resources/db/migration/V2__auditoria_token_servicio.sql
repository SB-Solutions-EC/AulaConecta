-- T1110-A: la bitácora también registra los tokens de servicio (client credentials) emitidos y rechazados.
-- En esos eventos usuario_id queda vacío y nombre_usuario_intentado guarda el client_id.
ALTER TABLE auditoria_acceso DROP CONSTRAINT auditoria_acceso_evento_check;
ALTER TABLE auditoria_acceso ADD CONSTRAINT auditoria_acceso_evento_check
    CHECK (evento IN ('LOGIN_OK', 'LOGIN_FALLIDO', 'BLOQUEO', 'DESBLOQUEO', 'CAMBIO_CLAVE', 'LOGOUT',
                      'ROL_ASIGNADO', 'ROL_RETIRADO', 'TOKEN_SERVICIO', 'TOKEN_SERVICIO_FALLIDO'));

COMMENT ON COLUMN cliente_servicio.hash_secreto IS
    'SHA-256 del secreto con el prefijo {sha256}. El secreto es aleatorio de 256 bits, así que no necesita un hash lento';
