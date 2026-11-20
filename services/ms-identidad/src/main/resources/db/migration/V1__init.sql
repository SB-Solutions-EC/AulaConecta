-- Esquema inicial de db_identidad (docs/arquitectura/c4.md, sección 5).
-- Solo datos para autenticar y autorizar: los datos personales viven en ms-academico.

CREATE TABLE usuario (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_usuario      VARCHAR(100) NOT NULL UNIQUE,
    hash_clave          TEXT NOT NULL,
    debe_cambiar_clave  BOOLEAN NOT NULL DEFAULT TRUE,
    estado              VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'
                        CHECK (estado IN ('ACTIVO', 'BLOQUEADO', 'INACTIVO')),
    intentos_fallidos   INTEGER NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    bloqueado_hasta     TIMESTAMPTZ,
    ultimo_acceso       TIMESTAMPTZ,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_por     UUID,
    version             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE rol (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       VARCHAR(30) NOT NULL UNIQUE,
    descripcion  TEXT NOT NULL
);

CREATE TABLE usuario_rol (
    usuario_id    UUID NOT NULL REFERENCES usuario (id),
    rol_id        UUID NOT NULL REFERENCES rol (id),
    asignado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    asignado_por  UUID,
    PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE sesion (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id          UUID NOT NULL REFERENCES usuario (id),
    hash_refresh_token  TEXT NOT NULL UNIQUE,
    dispositivo         VARCHAR(200),
    emitida_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en           TIMESTAMPTZ NOT NULL,
    revocada_en         TIMESTAMPTZ
);
CREATE INDEX idx_sesion_usuario ON sesion (usuario_id);

CREATE TABLE auditoria_acceso (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id                UUID REFERENCES usuario (id),
    nombre_usuario_intentado  VARCHAR(100),
    evento                    VARCHAR(30) NOT NULL
                              CHECK (evento IN ('LOGIN_OK', 'LOGIN_FALLIDO', 'BLOQUEO', 'DESBLOQUEO',
                                                'CAMBIO_CLAVE', 'LOGOUT', 'ROL_ASIGNADO', 'ROL_RETIRADO')),
    ip                        INET,
    ocurrido_en               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_usuario ON auditoria_acceso (usuario_id, ocurrido_en);
CREATE INDEX idx_auditoria_fecha ON auditoria_acceso (ocurrido_en);

-- La auditoría solo admite inserciones (RNF-09). Evita cambios desde la aplicación, pero el dueño
-- de la tabla podría desactivar el trigger: para impedirlo haría falta un usuario aparte para migrar.
CREATE FUNCTION rechazar_cambio_auditoria() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'auditoria_acceso solo admite inserciones';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditoria_sin_cambios
    BEFORE UPDATE OR DELETE ON auditoria_acceso
    FOR EACH ROW EXECUTE FUNCTION rechazar_cambio_auditoria();

CREATE TRIGGER auditoria_sin_truncate
    BEFORE TRUNCATE ON auditoria_acceso
    FOR EACH STATEMENT EXECUTE FUNCTION rechazar_cambio_auditoria();

CREATE TABLE cliente_servicio (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id     VARCHAR(100) NOT NULL UNIQUE,
    hash_secreto  TEXT NOT NULL,
    alcances      TEXT NOT NULL,
    activo        BOOLEAN NOT NULL DEFAULT TRUE
);

-- Solo claves públicas: la clave privada de firma llega al contenedor como secreto.
CREATE TABLE clave_firma (
    kid            VARCHAR(100) PRIMARY KEY,
    algoritmo      VARCHAR(10) NOT NULL DEFAULT 'RS256',
    clave_publica  TEXT NOT NULL,
    estado         VARCHAR(10) NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'RETIRADA')),
    creada_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    retirada_en    TIMESTAMPTZ
);

INSERT INTO rol (codigo, descripcion) VALUES
    ('ADMIN', 'Vicerrector: configuración, revisión de planificaciones y tablero institucional'),
    ('SECRETARIA', 'Matrícula, nóminas y avisos asistidos'),
    ('DOCENTE', 'Planificación, calificaciones, asistencia y comportamiento'),
    ('ESTUDIANTE', 'Consulta de notas, tareas, horario y asistencia'),
    ('REPRESENTANTE', 'Consulta de sus representados y recepción de avisos');
