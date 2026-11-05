# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A quiz-authoring and quiz-playing app with a Spring Boot REST API backend (`no.patreek.quiz`, Java 21) and a React + TypeScript + Vite frontend (`frontend/`). Auth is JWT-based (stateless, no sessions).

## Product direction

QuizApp is a study application inspired by Quizlet.

The long-term goal is to support the core study workflow users expect from
a modern flashcard/study platform, while keeping our own implementation,
architecture, UI, and branding.

Core product areas include:
- Study sets / quizzes
- Terms and definitions
- Flashcards
- Multiple-choice practice
- Written-answer practice
- Study/test modes
- Progress and scoring
- Creating and editing study material
- Sharing study sets

When implementing new features:
- Follow the existing QuizApp architecture and conventions.
- Do not copy Quizlet source code, proprietary assets, or UI verbatim.
- Use Quizlet only as product inspiration when explicitly requested.
- Prefer incremental features over large rewrites.

### Backend (repo root, Maven)
```bash
./mvnw spring-boot:run        # run API on :8080 (needs Postgres, see below)
./mvnw test                   # run all tests (uses in-memory H2, no DB needed)
./mvnw test -Dtest=QuizApiIntegrationTests          # single test class
./mvnw test -Dtest=QuizApiIntegrationTests#someTest  # single test method
./mvnw clean package -DskipTests   # build the jar (what the Dockerfile does)
```
Backend dev DB: `./mvnw spring-boot:run` expects Postgres on `localhost:5432` with the credentials hardcoded in `src/main/resources/application.properties` (`quizapp`/`quizapp`/`quizapp`). No compose file in the repo publishes that port, so start a standalone container:
```bash
docker run -d --name quizapp-dev-db -p 5432:5432 \
  -e POSTGRES_DB=quizapp -e POSTGRES_USER=quizapp -e POSTGRES_PASSWORD=quizapp \
  -v quizapp-dev-db:/var/lib/postgresql postgres:18
```
Tests don't touch this — they run against H2 in Postgres-compatibility mode (`src/test/resources/application.properties`).

The root `docker-compose.yml` is **not** a dev DB file: it's a full containerized stack (frontend + backend + postgres) where Postgres is only reachable on the internal compose network and the frontend joins an external `cloudflare` Docker network (must already exist: `docker network create cloudflare`). Nothing is published to the host. The production stack is `docker-compose.prod.yml` (see `DEPLOY.md`).

### Frontend (`frontend/`, npm)
```bash
npm install
npm run dev        # Vite dev server, proxies nothing — calls backend directly at :8080 in dev
npm run test       # vitest run
npm run lint       # eslint
npm run build      # tsc -b && vite build
npm run preview    # preview a production build locally
```
Run a single frontend test file: `npx vitest run src/components/QuizPlayer.test.tsx`.

## Architecture

### Backend: layered, per-entity vertical slices
Each domain concept (`Quiz`, `Question`, `AnswerOption`) has a matching Controller → Service → Repository → Entity stack under `src/main/java/no/patreek/quiz/{controller,service,repository,model}`. Controllers are thin: they delegate to services and translate `null`/`boolean` results into 404/204, with no business logic. Request/response shapes live in `dto/auth` and `dto/quiz` as Java records — controllers never expose entities directly.

Entity relationships: `User` owns `Quiz` (`owner_id`) → `Quiz` has many `Question` (ordered via `orderIndex`, with a dedicated `/reorder` endpoint) → `Question` has many `AnswerOption` (`correct` flag). All quiz/question/answer endpoints take the current user from `@AuthenticationPrincipal` and scope every lookup/mutation to quizzes owned by that user — a mismatch returns a service-level `null`/`false` that the controller turns into 404, not a thrown exception.

Auth: `JwtAuthenticationFilter` (in `security/`) runs before `UsernamePasswordAuthenticationFilter`, validates the bearer token via `JwtService`, and sets the `User` as the authentication principal. `SecurityConfig` permits `/api/auth/**` and requires authentication on everything else; CORS allowed origins come from `app.cors.allowed-origins` (defaults to the Vite dev ports, overridden by `APP_CORS_ALLOWED_ORIGINS`/`PUBLIC_ORIGIN` in prod).

Validation errors and other exceptions are centralized in `web/GlobalExceptionHandler`, returning the `ErrorResponse` shape (`error` + optional `fieldErrors`) that the frontend's `api/client.ts` expects.

### Frontend: single API client, with a built-in demo mode
All HTTP access goes through `frontend/src/api/client.ts`. It picks the base URL based on environment: `http://localhost:8080` in dev, relative paths in production (so the prod nginx same-origin proxy handles `/api/*` and no CORS is needed), overridable via `VITE_API_BASE_URL`.

That same client also implements a **demo mode**: when the URL is `/demo` or has `?demo=true`, every `apiGet/apiPost/apiPatch/apiDelete` call is intercepted and served from an in-memory seed dataset persisted to `sessionStorage` instead of hitting the network — this lets `/demo` work as a fully interactive, backend-free sandbox. When adding or changing an API endpoint, keep the demo-mode branch in `client.ts` in sync with the real one if the route is reachable from a demo-mode page.

Auth state lives in `auth/AuthContext.ts` + `auth/AuthProvider.tsx`, with `auth/RequireAuth.tsx` guarding protected routes. The JWT is stored in `localStorage`; a 401 response triggers the `onUnauthorized` handler registered via `setUnauthorizedHandler`.

### Deployment topology differs from dev
In dev, frontend and backend run as separate processes talking cross-origin (CORS configured for it). In production (`docker-compose.prod.yml`), nginx serves the built frontend and reverse-proxies `/api/*` to the backend container, so the browser only ever talks to one origin — only the frontend container's port is published to the host. See `DEPLOY.md` for the full production deployment procedure (env setup, Cloudflare Tunnel wiring, redeploy/rollback).
