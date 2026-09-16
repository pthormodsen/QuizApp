# Deploying to your Ubuntu server

This deploys three containers via `docker-compose.prod.yml`: Postgres, the Spring Boot
backend, and an nginx container that serves the built React app and reverse-proxies
`/api/*` to the backend (same origin, so no CORS is needed). Only the frontend
container is published, on `127.0.0.1:${APP_PORT}` (default `8090`) - nothing is
exposed to the public internet directly; your Cloudflare Tunnel reaches it via
localhost, same as your other apps.

## One-time setup on the server

1. Install Docker + the Compose plugin if not already present:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # log out/in after this
   ```
2. Copy the repo to the server (git clone, or `scp`/`rsync`) and `cd` into it.
3. Create your `.env` from the template and fill in real values:
   ```bash
   cp .env.example .env
   openssl rand -base64 48   # paste the output in as JWT_SECRET
   nano .env                 # set POSTGRES_PASSWORD, JWT_SECRET, PUBLIC_ORIGIN, APP_PORT
   ```
   `PUBLIC_ORIGIN` should be the hostname you'll expose via the tunnel, e.g.
   `https://quiz.patreek.no`. Pick an `APP_PORT` that isn't already used by another
   app on the box.

## Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps      # all three should show healthy
```

## Wire up the Cloudflare Tunnel

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
tunnel, the same way you did for your other apps.

## Redeploying after a code change

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

This rebuilds only the images whose source changed and does a rolling restart.
Postgres data persists in the `quizapp_prod_postgres_data` named volume across
restarts and rebuilds.

## Logs / troubleshooting

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f postgres
```

## Notes / caveats

- Schema changes are applied automatically by Hibernate (`ddl-auto=update`) on
  backend startup, same as in dev. There's no migration tool (Flyway/Liquibase) in
  this project yet - fine for now, but worth adding before the data really matters,
  since `update` can't express destructive changes (renames, drops) safely.
- `.env` is gitignored - never commit it. Back it up somewhere safe (a password
  manager, not the repo) since it holds your DB password and JWT signing secret;
  losing the JWT secret just invalidates existing login sessions, losing the DB
  password without a backup could lock you out of your own data.
- The backend and postgres ports are not published to the host at all (only
  reachable from other containers on the compose network) - if you ever need to
  `psql` in directly, use `docker compose -f docker-compose.prod.yml exec postgres psql -U quizapp`.
