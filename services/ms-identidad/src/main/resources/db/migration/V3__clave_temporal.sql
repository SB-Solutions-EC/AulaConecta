-- CR-02 (RF-03 v1.1, RN-13): la clave inicial ya no es la cédula. Es una clave temporal aleatoria,
-- de un solo uso, que vence a las 72 horas. Se guarda solo su hash Argon2id en hash_clave.
--   clave_temporal_vence: hasta cuándo sirve; NULL = la cuenta no tiene clave temporal pendiente
--   clave_temporal_usada: ya se usó para iniciar sesión una vez; otro inicio con ella se rechaza
ALTER TABLE usuario
    ADD COLUMN clave_temporal_vence TIMESTAMPTZ,
    ADD COLUMN clave_temporal_usada BOOLEAN NOT NULL DEFAULT FALSE;

-- La secretaría o el administrador generan otra clave temporal (evento CLAVE_TEMPORAL)
ALTER TABLE auditoria_acceso DROP CONSTRAINT auditoria_acceso_evento_check;
ALTER TABLE auditoria_acceso ADD CONSTRAINT auditoria_acceso_evento_check
    CHECK (evento IN ('LOGIN_OK', 'LOGIN_FALLIDO', 'BLOQUEO', 'DESBLOQUEO', 'CAMBIO_CLAVE', 'LOGOUT',
                      'ROL_ASIGNADO', 'ROL_RETIRADO', 'TOKEN_SERVICIO', 'TOKEN_SERVICIO_FALLIDO', 'CLAVE_TEMPORAL'));
