-- Crea las tres bases de AulaConecta, cada una con su propio usuario (docs/arquitectura/c4.md, sección 3).
-- PostgreSQL lo ejecuta una sola vez, al iniciar un volumen de datos vacío.
-- Las contraseñas llegan por variables de entorno: nunca se escriben aquí.

\set ON_ERROR_STOP on

\getenv clave_identidad POSTGRES_IDENTIDAD_PASSWORD
\getenv clave_academico POSTGRES_ACADEMICO_PASSWORD
\getenv clave_notificaciones POSTGRES_NOTIFICACIONES_PASSWORD

-- Usuarios sin privilegios: ninguno puede crear bases ni otros usuarios
CREATE ROLE usr_identidad LOGIN PASSWORD :'clave_identidad' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE usr_academico LOGIN PASSWORD :'clave_academico' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE usr_notificaciones LOGIN PASSWORD :'clave_notificaciones' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Cada usuario es dueño solo de su base
CREATE DATABASE db_identidad OWNER usr_identidad ENCODING 'UTF8';
CREATE DATABASE db_academico OWNER usr_academico ENCODING 'UTF8';
CREATE DATABASE db_notificaciones OWNER usr_notificaciones ENCODING 'UTF8';

-- Por defecto, cualquier usuario puede conectarse a cualquier base. Se revoca para que
-- un servicio comprometido no pueda entrar a la base de otro, ni a las bases del sistema.
REVOKE ALL ON DATABASE db_identidad FROM PUBLIC;
REVOKE ALL ON DATABASE db_academico FROM PUBLIC;
REVOKE ALL ON DATABASE db_notificaciones FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
REVOKE ALL ON DATABASE template1 FROM PUBLIC;
