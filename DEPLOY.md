# Deploying QuizApp to production (docker01)

Production runs pre-built images from GHCR; the server never builds source and
needs no Java, Maven or Node toolchain - only Docker + the Compose plugin.

```
push to main → GitHub Actions (.github/workflows/publish-images.yml)
             → ghcr.io/pthormodsen/quizapp-backend:{latest,<sha>}
             → ghcr.io/pthormodsen/quizapp-frontend:{latest,<sha>}
docker01     → docker compose pull && docker compose up -d
```

`docker-compose.prod.yml` runs three containers: Postgres, the Spring Boot
backend, and an nginx container that serves the built React app and
reverse-proxies `/api/*` to the backend (same origin, so no CORS is needed). Only
the frontend container is published, on `127.0.0.1:${APP_PORT}` (default `8090`) -
nothing is exposed to the public internet directly; your Cloudflare Tunnel reaches
it via localhost. Backend and Postgres are reachable only on the internal compose
network.

## What the server needs

Just two files in one directory (e.g. `~/quizapp`):

- `docker-compose.prod.yml` (from this repo)
- `.env` (created from `.env.example`, never committed)

A full git checkout also works and makes updating the compose file a `git pull`,
but it isn't required - nginx config is baked into the frontend image.

## Required environment variables (`.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | yes | Postgres password (also used by the backend) |
| `JWT_SECRET` | yes | JWT signing secret (`openssl rand -base64 48`) |
| `POSTGRES_DB` / `POSTGRES_USER` | no (default `quizapp`) | Database name / user |
| `JWT_EXPIRATION_MS` | no (default `86400000`) | Token lifetime |
| `PUBLIC_ORIGIN` | recommended | Public URL, used for CORS, e.g. `https://quiz.patreek.no` |
| `APP_PORT` | no (default `8090`) | Host port on 127.0.0.1 that cloudflared targets |
| `QUIZAPP_IMAGE_TAG` | no (default `latest`) | Image tag to run: `latest` or a full commit SHA |

`POSTGRES_*` values only take effect when the data volume is first created; never
change them on an existing deployment.

## GHCR authentication

GHCR packages are private by default. Either make both packages public
(GitHub → your profile → Packages → `quizapp-backend` / `quizapp-frontend` →
Package settings → Change visibility), or log the server in once with a classic
personal access token that has only the `read:packages` scope:

```bash
echo <TOKEN> | docker login ghcr.io -u pthormodsen --password-stdin
```

The credential is stored in `~/.docker/config.json` of the user that runs
`docker compose`.

## First deployment

1. Install Docker + the Compose plugin if not already present:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # log out/in after this
   ```
2. Put `docker-compose.prod.yml` and `.env.example` in a directory on the server
   (`git clone`, or `scp`), then create `.env`:
   ```bash
   cp .env.example .env
   openssl rand -base64 48   # paste the output in as JWT_SECRET
   nano .env                 # set POSTGRES_PASSWORD, JWT_SECRET, PUBLIC_ORIGIN, APP_PORT
   ```
3. Authenticate to GHCR if the packages are private (see above).
4. Pull and start:
   ```bash
   docker compose -f docker-compose.prod.yml pull
   docker compose -f docker-compose.prod.yml up -d
   docker compose -f docker-compose.prod.yml ps   # all three should become healthy
   ```

### Migrating from the old build-on-server setup

The compose project name (`quizapp-prod`) and volume name are unchanged, so
existing data in `quizapp_prod_postgres_data` is reused. Just update
`docker-compose.prod.yml`, add `QUIZAPP_IMAGE_TAG=latest` to `.env` (optional),
then run the pull/up commands above. Never run `docker compose down -v`. The old
locally built images can be removed afterwards with `docker image prune`.

## Wire up the Cloudflare Tunnel (first deployment only)

Add an ingress rule to your existing `cloudflared` `config.yml` (before the final
catch-all `http_status:404` rule), pointing at the port from `.env`:

```yaml
ingress:
  - hostname: quiz.patreek.no
    service: http://localhost:8090
  - service: http_status:404
```

Then restart cloudflared (`sudo systemctl restart cloudflared`) and add the usual
CNAME record for `quiz.patreek.no` in the Cloudflare dashboard, pointing at your
tunnel.

## Normal deployment

Push to `main`, wait for the "Publish production images" workflow to finish, then
on the server:

```bash
git pull   # only if you keep a checkout and the compose file changed
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Compose recreates only containers whose image changed. Postgres data persists in
the `quizapp_prod_postgres_data` named volume.

## Health and logs

```bash
docker compose -f docker-compose.prod.yml ps                 # STATUS shows (healthy)
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f postgres
curl -I http://127.0.0.1:8090/                               # frontend via nginx
docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' quizapp-prod-backend-1   # running commit
```

## Rollback

Every published build is also tagged with its full commit SHA, so rollback is a
tag switch - no rebuild. Not every commit has an image (docs/test-only commits
don't trigger the workflow, and queued runs can be superseded by newer pushes), so
pick the SHA from the GHCR package's version list or from a successful "Publish
production images" run - not from `git log`. Then:

```bash
# in .env
QUIZAPP_IMAGE_TAG=<full-commit-sha>

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

To return to tracking new releases, set `QUIZAPP_IMAGE_TAG=latest` again and
pull/up. Backend and frontend always share a tag, so they roll back as a pair.

Caveat: Hibernate `ddl-auto=update` only adds schema (columns/tables), never
removes it, so rolling the backend back past a schema addition normally still
works, but the database itself is not rolled back.

## Watchtower

All three services carry `com.centurylinklabs.watchtower.enable=false`, so a
Watchtower instance on the host won't auto-update QuizApp. Deployments are
explicit (pull/up) for predictability and easy rollback. To opt the app
containers into auto-updates later, flip the label to `"true"` on `backend` and
`frontend` only (never `postgres`) and keep `QUIZAPP_IMAGE_TAG=latest`.

## Notes / caveats

- Schema changes are applied automatically by Hibernate (`ddl-auto=update`) on
  backend startup. There's no migration tool (Flyway/Liquibase) yet - worth adding
  before the data really matters, since `update` can't express destructive changes
  (renames, drops) safely.
- `.env` is gitignored - never commit it. Back it up somewhere safe (a password
  manager, not the repo) since it holds your DB password and JWT signing secret.
- If you ever need to `psql` in directly, use
  `docker compose -f docker-compose.prod.yml exec postgres psql -U quizapp`.
