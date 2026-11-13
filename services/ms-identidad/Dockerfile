# Etapa de compilación: se separan las dependencias para aprovechar la caché de Docker.
FROM maven:3.9.16-eclipse-temurin-21-alpine AS compilacion
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

# Imagen final: solo el JRE y el jar, con un usuario sin privilegios.
FROM eclipse-temurin:21-jre-alpine-3.24
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
WORKDIR /app
COPY --from=compilacion /app/target/ms-identidad-*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
