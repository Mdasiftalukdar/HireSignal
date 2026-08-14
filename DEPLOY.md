# Deploying HireSignal (backend on Oracle Always Free, frontend on Vercel)

The frontend runs on Vercel. The backend and all its services (FastAPI, Postgres,
Redis, Kafka, ChromaDB, MinIO) run with Docker Compose on a free Oracle Cloud ARM
VM, behind a Caddy reverse proxy that provides automatic HTTPS.

```
Browser ─► Vercel (frontend, HTTPS) ─► Caddy (HTTPS, Let's Encrypt) ─► api:8000 ─► Postgres/Redis/Kafka/Chroma/MinIO
```

## 1. Create the Oracle VM

1. Sign up at cloud.oracle.com (a card is required for identity verification;
   Always Free resources are never charged).
2. Compute ► Instances ► **Create instance**:
   - **Shape:** change to **Ampere / VM.Standard.A1.Flex**, e.g. **2 OCPU / 12 GB**
     (up to 4 OCPU / 24 GB is free).
   - **Image:** Canonical **Ubuntu 22.04** (arm64).
   - **SSH keys:** upload your public key (or let Oracle generate one and save it).
   - Leave networking on the default VCN with a public IP.
3. Note the instance's **public IP**.

## 2. Open ports 80 and 443

Two firewalls must allow them:

- **Oracle VCN security list:** Networking ► your VCN ► default security list ►
  add ingress rules: source `0.0.0.0/0`, TCP, destination ports **80** and **443**.
- **On the VM (Ubuntu's own iptables):**
  ```bash
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  sudo netfilter-persistent save
  ```

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # then log out and back in
```

## 4. Free HTTPS hostname (DuckDNS)

1. Sign in at duckdns.org (GitHub login), create a subdomain, e.g. `hiresignal-asif`.
2. Set its IP to the VM's public IP (paste it and Update).
3. Your backend URL is now `https://hiresignal-asif.duckdns.org`.

## 5. Clone the repo and set production env

```bash
git clone https://github.com/Mdasiftalukdar/HireSignal.git
cd HireSignal
cp .env.example .env
nano .env
```

Set these to production values (keep the rest as-is):

```env
SECRET_KEY=<a long random string>            # e.g. `openssl rand -hex 32`
BACKEND_DOMAIN=hiresignal-asif.duckdns.org
FRONTEND_URL=https://hire-signal-gilt.vercel.app
CORS_ORIGINS=https://hire-signal-gilt.vercel.app
GOOGLE_REDIRECT_URI=https://hiresignal-asif.duckdns.org/api/v1/auth/google/callback
OPENROUTER_API_KEY=<your key>
GOOGLE_CLIENT_ID=<your id>
GOOGLE_CLIENT_SECRET=<your secret>
```

## 6. Register the production Google OAuth callback

Google Cloud Console ► APIs & Services ► Credentials ► your OAuth client ►
add to **Authorized redirect URIs**:
`https://hiresignal-asif.duckdns.org/api/v1/auth/google/callback`

## 7. Deploy

The container runs as a non-root user (uid 1000), so the bind-mounted cache dirs
must be writable by it, or the embedding model download fails with a PermissionError:

```bash
mkdir -p .cache/huggingface chroma_data
sudo chown -R 1000:1000 .cache chroma_data
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api alembic upgrade head
```

The first build is slow (torch + ML libs on ARM). Check it is up:

```bash
curl https://hiresignal-asif.duckdns.org/health   # -> {"status":"ok",...}
```

## 8. Point the frontend at the backend

In Vercel ► Project ► Settings ► Environment Variables, add:

```
NEXT_PUBLIC_API_BASE = https://hiresignal-asif.duckdns.org/api/v1
```

Redeploy (Vercel ► Deployments ► Redeploy). The full app now works end to end.

## Operations

- Logs: `docker compose logs -f api`
- Update after a push: `git pull && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`
  (R5c automates this via GitHub Actions).
- Email OTP for password signups needs a real SMTP provider; Google sign-in works
  without it. Set `SMTP_HOST/PORT/FROM` (+ credentials) to a provider to enable it.
