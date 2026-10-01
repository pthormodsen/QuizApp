# Backend production image: build the Spring Boot jar with the Maven wrapper,
# then ship only the jar on a JRE base.
FROM eclipse-temurin:21-jdk AS build

WORKDIR /app

# Resolve dependencies in their own layer so source-only changes reuse it.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN ./mvnw -B -q dependency:go-offline

COPY src src
RUN ./mvnw -B -q clean package -DskipTests

FROM eclipse-temurin:21-jre

WORKDIR /app
RUN useradd --system --no-create-home --shell /usr/sbin/nologin quizapp
COPY --from=build /app/target/*.jar app.jar
USER quizapp

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
