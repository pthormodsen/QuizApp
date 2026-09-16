# --- Build stage ---
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# Cache dependencies separately from source so code changes don't bust the layer.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q -DskipTests package && \
    mv target/*.jar target/app.jar

# --- Runtime stage ---
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

RUN useradd --system --no-create-home appuser
COPY --from=build /build/target/app.jar app.jar
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=5 \
    CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8080' || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
