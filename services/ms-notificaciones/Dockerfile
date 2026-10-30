# Etapa de compilación: instala dependencias en un entorno virtual aislado.
FROM python:3.12-alpine3.21 AS compilacion
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Imagen final: solo el entorno virtual y el código, con usuario sin privilegios.
FROM python:3.12-alpine3.21
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"
COPY --from=compilacion /opt/venv /opt/venv
COPY app ./app
USER app
EXPOSE 8000
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

