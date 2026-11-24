# Etapa de compilación: instala dependencias en un entorno virtual aislado.
FROM python:3.12-alpine3.24 AS compilacion
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Imagen final: entorno virtual, código y migraciones de Alembic, con usuario sin privilegios.
FROM python:3.12-alpine3.24
RUN apk upgrade --no-cache && \
    addgroup -S -g 10001 app && \
    adduser -S -u 10001 -G app app
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
COPY --from=compilacion /opt/venv /opt/venv
# En ejecución no se instala nada: pip sobra y trae una copia de setuptools con vulnerabilidades
RUN /opt/venv/bin/python -m pip uninstall -y -q pip && \
    python -m pip uninstall -y -q pip setuptools wheel 2>/dev/null || true
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY app ./app
USER app
EXPOSE 8000
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
