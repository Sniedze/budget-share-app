# Migrating soperfect.dk from one.com to Hetzner

A focused, step-by-step plan for **your specific case**:

- Currently on one.com: static HTML/CSS/JS only (school projects).
- Email at `@soperfect.dk`: not used — no email migration needed.
- School projects: discarded — root domain serves the Budget Share app only.
- Acceptable downtime: a few hours during DNS cutover.
- Domain registrar: punktum.dk (stays — only DNS records change).
- Target stack: Hetzner Cloud VPS + Docker Compose (already in repo) + **Caddy** in place of nginx for automatic HTTPS via Let's Encrypt.

**Estimated total clock time:** 2–4 hours of hands-on work, plus ≤1 hour of DNS propagation.

**Estimated ongoing cost above current:** ~30 DKK/month (Hetzner CAX11) + ~5 DKK/month for snapshot backups. Free SMTP via Resend if/when invitation emails are needed.

---

## Phase 1 — Hetzner: account and server (≈30 min)

1. **Create a Hetzner Cloud account** at `console.hetzner.cloud`. Add a payment method (card or PayPal).
2. **Create a new project** named e.g. `soperfect-prod`.
3. **Add your SSH public key** under *Security → SSH Keys*. If you don't have one yet:
   ```bash
   ssh-keygen -t ed25519 -C "soperfect-deploy" -f ~/.ssh/soperfect_ed25519
   ```
   Upload the contents of `~/.ssh/soperfect_ed25519.pub`.
4. **Create a server** under *Servers → Add Server*:
   - Location: **Falkenstein** (lowest latency from Denmark) or Helsinki.
   - Image: **Ubuntu 24.04 LTS**.
   - Type: **CAX11** (ARM, 2 vCPU / 4 GB RAM / 40 GB disk) — about €3.79/month. Plenty for this stack.
   - Networking: leave defaults (public IPv4 + IPv6 enabled).
   - SSH key: select the key you just added.
   - Backups: enable (€0.76/month for nightly snapshots — worth it).
   - Name: `soperfect-prod`.
5. **Note the public IPv4 and IPv6** addresses Hetzner shows after provisioning. You'll need them at DNS-cutover time.
6. **SSH in as root** to confirm:
   ```bash
   ssh -i ~/.ssh/soperfect_ed25519 root@<IPV4>
   ```

---

## Phase 2 — Server hardening and dependencies (≈20 min)

Run these on the server. Everything below assumes you're connected as `root` over SSH.

### 2.1 — Updates and a non-root user

```bash
apt update && apt upgrade -y
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

Test SSH as `deploy` from a **new** terminal before continuing:
```bash
ssh -i ~/.ssh/soperfect_ed25519 deploy@<IPV4>
```

Once that works, lock down root SSH (still as root in the original terminal):
```bash
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

### 2.2 — Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
```

### 2.3 — Automatic security updates

```bash
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades   # answer "Yes"
```

### 2.4 — Docker

```bash
apt install -y ca-certificates curl gnupg git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deploy
```

Log out and back in as `deploy` so the docker group membership takes effect. Verify:
```bash
docker run --rm hello-world
```

### 2.5 — Optional: fail2ban

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

---

## Phase 3 — Code preparation (Caddy swap) (≈30 min)

The repo currently uses nginx (`deploy/Dockerfile.nginx` + `deploy/nginx/default.conf`) and listens on port 80 only. For this deploy you want HTTPS, and Caddy gets Let's Encrypt certificates automatically with zero cron jobs. Three small files need to change.

### 3.1 — Caddyfile

Create `deploy/Caddyfile`:

```caddyfile
soperfect.dk, www.soperfect.dk {
    encode gzip zstd

    handle /graphql* {
        reverse_proxy api:4000
    }

    handle /health {
        reverse_proxy api:4000
    }

    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

### 3.2 — Caddy Dockerfile

Replace `deploy/Dockerfile.nginx` (or create `deploy/Dockerfile.caddy`) with:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
ARG VITE_GRAPHQL_URL=/graphql
ENV VITE_GRAPHQL_URL=${VITE_GRAPHQL_URL}
RUN npm run build

FROM caddy:2.8-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=client-builder /app/client/dist /srv
```

### 3.3 — Compose adjustments

Edit `docker-compose.prod.yml` so the `web` service uses the new Dockerfile, exposes 443 too, and persists Caddy's certificate data:

```yaml
  web:
    build:
      context: .
      dockerfile: deploy/Dockerfile.caddy
      args:
        VITE_GRAPHQL_URL: ${VITE_GRAPHQL_URL:-/graphql}
    restart: unless-stopped
    depends_on:
      - api
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - internal

volumes:
  mysql_data:
  caddy_data:
  caddy_config:
```

(Keep the rest of the file intact. The `caddy_data` volume persists certificates across container restarts — losing it means Caddy will re-request certs from Let's Encrypt, which has tight rate limits, so keep this volume around forever.)

### 3.4 — Commit and push

Test locally if you like (`docker compose -f docker-compose.prod.yml build`), then commit:

```bash
git checkout -b deploy/caddy
git add deploy/Caddyfile deploy/Dockerfile.caddy docker-compose.prod.yml
git rm deploy/Dockerfile.nginx deploy/nginx/default.conf
git commit -m "deploy: swap nginx for Caddy with automatic HTTPS"
git push -u origin deploy/caddy
```

Merge to `main` once you're ready.

---

## Phase 4 — Generate production secrets (≈10 min)

On your **local machine**, generate strong secrets:

```bash
echo "MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d /+=)"
echo "MYSQL_PASSWORD=$(openssl rand -base64 32 | tr -d /+=)"
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
```

Store these in your password manager — you'll paste them into the server's `.env` in Phase 5 and you'll want them again for backup/restore.

Optional, for invitation email: sign up for **Resend** (3,000 free emails/month). Verify a sending domain (Resend gives DNS records for SPF/DKIM/DMARC — add them at punktum.dk). They'll provide `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`. Use `SMTP_FROM="BudgetShare <noreply@soperfect.dk>"`.

---

## Phase 5 — Deploy on the server (≈20 min)

SSH back as `deploy`:

```bash
ssh -i ~/.ssh/soperfect_ed25519 deploy@<IPV4>
```

Clone and configure:

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/Sniedze/budget-share-app.git
cd budget-share-app
git checkout main      # ensure your Caddy changes are merged
cp .env.example .env
nano .env
```

Fill in `.env` — uncomment and set these (leave the others at defaults):

```env
# Docker Compose (MySQL)
MYSQL_ROOT_PASSWORD=<from-phase-4>
MYSQL_DATABASE=budget_app
MYSQL_USER=budget_user
MYSQL_PASSWORD=<from-phase-4>

# API server
TRUST_PROXY=1
ALLOWED_ORIGINS=https://soperfect.dk,https://www.soperfect.dk
JSON_BODY_LIMIT=512kb
GRAPHQL_MAX_RECURSIVE_SELECTIONS=30

# JWT
JWT_ACCESS_SECRET=<from-phase-4>
JWT_REFRESH_SECRET=<from-phase-4>
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=604800

# Email (only if you set up Resend / Brevo / etc.)
APP_PUBLIC_URL=https://soperfect.dk
# SMTP_HOST=smtp.resend.com
# SMTP_PORT=465
# SMTP_SECURE=1
# SMTP_USER=resend
# SMTP_PASS=<resend-api-key>
# SMTP_FROM=BudgetShare <noreply@soperfect.dk>

# Vite (build-time)
VITE_GRAPHQL_URL=/graphql
```

Lock the file:
```bash
chmod 600 .env
```

Build and start:
```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

You should see:
- MySQL start and become healthy.
- API logs: `MySQL connection established`, `Database schema ensured`, `Database schema migrated`, `Server running on http://localhost:4000`.
- Caddy logs will warn about TLS until DNS resolves to this server — that's normal at this stage.

---

## Phase 6 — Pre-cutover smoke test (≈15 min)

Before changing DNS, verify the stack works against the Hetzner IP.

### 6.1 — HTTP path

From your **laptop**, edit `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows) to override DNS:

```
<IPV4>  soperfect.dk www.soperfect.dk
```

Visit `http://soperfect.dk` in a browser (note: **http** for now — TLS won't work until DNS is real because Let's Encrypt validates over the public DNS name pointing at your IP).

You should see the Budget Share login page. Try:
- Register a new account.
- Log in.
- Refresh the page → still logged in (cookie persistence).
- Log out → redirected to login.
- Verify `https://soperfect.dk/health` returns `{"ok":true,"service":"server"}` (over `http://` for now).

**Don't proceed if any of these fail.** Check `docker compose logs api` and `docker compose logs web` first.

### 6.2 — Clean up

Remove the `hosts` override from your laptop before the next phase.

---

## Phase 7 — DNS cutover at punktum.dk (≈15 min + 0–60 min propagation)

This is the moment the live site moves. With "a few hours of outage acceptable" you can do this straight up — no TTL-lowering ritual.

1. **Log in to punktum.dk** → domain admin for `soperfect.dk`.
2. **Find DNS records (DNS / Avancerede indstillinger).** Note the current values somewhere — you might want them for rollback. Then:
   - Delete or update the existing `A` record(s) pointing at one.com.
   - Delete existing `www` records that point at one.com.
   - Delete `MX` records if any (you said you don't use email).
3. **Add new records:**
   - `A` record: name `@` (or blank), value `<Hetzner IPv4>`, TTL 300 if punktum lets you choose.
   - `AAAA` record: name `@`, value `<Hetzner IPv6>`.
   - `A` record: name `www`, value `<Hetzner IPv4>`.
   - `AAAA` record: name `www`, value `<Hetzner IPv6>`.
4. **Save.**

Verify propagation from your laptop:

```bash
dig soperfect.dk A +short
dig www.soperfect.dk A +short
```

Both should return your Hetzner IPv4. If one returns the old one.com IP, wait a few minutes and try again. Most DNS caches will update within 5–30 minutes; full global propagation can take up to a few hours but is usually fast for fresh records on a registrar that respects TTLs.

---

## Phase 8 — TLS issuance and final smoke test (≈5 min once DNS is live)

As soon as `dig` shows the new IP, Caddy on the server will try to fetch a Let's Encrypt cert. Watch:

```bash
docker compose -f docker-compose.prod.yml logs -f web
```

You'll see lines like `certificate obtained successfully` or `tls obtained certificate {"identifier":"soperfect.dk"}`. If you see ACME errors, the most likely cause is DNS not yet pointing at this server — wait.

Once a cert is issued, visit:

- `https://soperfect.dk` — should serve the SPA with a green padlock.
- `https://soperfect.dk/health` — `{"ok":true,"service":"server"}`.
- Register again with a real email (the old test account from Phase 6 is fine to keep). Log in, refresh, log out — confirm cookies survive a reload over HTTPS.

Run through `DEPLOYMENT_CHECKLIST.md` section 5 (the existing smoke-test plan in your repo).

---

## Phase 9 — Backups (≈15 min — do this once it's live)

### 9.1 — Hetzner snapshots

Already enabled in Phase 1 if you ticked the backup checkbox. These are full-machine nightly snapshots, kept for 7 days. Confirm at *Server → Backups*.

### 9.2 — Database dumps

Edit `crontab -e` as `deploy`:

```cron
0 3 * * * cd /home/deploy/apps/budget-share-app && docker compose -f docker-compose.prod.yml exec -T mysql sh -c 'exec mysqldump --single-transaction --quick --lock-tables=false -u root -p"$MYSQL_ROOT_PASSWORD" budget_app' | gzip > /home/deploy/backups/budget-$(date +\%F).sql.gz 2>>/home/deploy/backups/dump.log
5 3 * * 0 find /home/deploy/backups -name 'budget-*.sql.gz' -mtime +14 -delete
```

Create the dir first:
```bash
mkdir -p /home/deploy/backups
```

This dumps daily at 03:00, keeps two weeks, logs errors. To verify a dump can be restored, on a throwaway:
```bash
gunzip < budget-2026-05-13.sql.gz | docker compose -f docker-compose.prod.yml exec -T mysql mysql -u root -p"<password>" budget_app
```

### 9.3 — Off-server backups (optional but recommended)

Snapshots and on-server dumps both die if the VPS does. Once a week, copy backups elsewhere:

- `scp deploy@<IPV4>:/home/deploy/backups/*.sql.gz ~/backups/soperfect/` from your laptop, or
- A free Backblaze B2 bucket (10 GB free) with `rclone sync` from the server.

---

## Phase 10 — Cancel one.com (≈10 min)

Wait **at least 7 days** after cutover before touching one.com. If something subtle breaks (a forgotten image URL, an old bookmark, weird DNS cache), one.com is your fallback.

After the waiting period:
1. **Take one final FTP backup** of whatever's still on one.com — zip the `public_html` (or equivalent) and store it offline. Costs you nothing in storage and you can never get it back once cancelled.
2. **Log in to one.com control panel**.
3. **Cancel the hosting subscription**. one.com typically requires you to *disable auto-renewal* and let the current paid-for period run out — they generally don't refund unused months. Check the cancellation rules in your contract; in Denmark, consumer rules give you 14 days from purchase but past that you're usually committed to the period you paid.
4. **Remove any nameserver pointers** that still point at one.com at the registrar (you already did this in Phase 7, but double-check).
5. **Disconnect billing** (remove card from one.com).

---

## Rollback plan (in case anything goes wrong post-cutover)

If something fundamental breaks after DNS cutover:

1. **Fast revert at punktum.dk**: change the `A`/`AAAA` records back to the old one.com values you noted in Phase 7. TTL 300 means most users see the old site again within 5–10 minutes.
2. **App-level revert without changing DNS**: on the Hetzner server, `git checkout <previous-commit> && docker compose -f docker-compose.prod.yml up -d --build` to roll back the app code only. Cert and Caddy stay in place.
3. **Snapshot restore**: from Hetzner Console, restore a backup snapshot from before the breaking change (full server reset; you'd lose any data written since the snapshot).

Keep the old one.com IP and DNS values in your password manager for at least 30 days as your nuclear-option rollback.

---

## What you'll be paying after migration

| Item | Cost | When |
|---|---|---|
| punktum.dk `.dk` domain | ~50 DKK/yr | already paying |
| Hetzner CAX11 | ~28 DKK/mo (~340 DKK/yr) | new |
| Hetzner snapshot backups | ~6 DKK/mo (~70 DKK/yr) | new |
| Cloudflare | 0 | not using |
| Resend SMTP free tier | 0 (≤3,000 emails/month) | optional |
| **Total new spend** | **~34 DKK/mo (~410 DKK/yr)** | |

You stop paying one.com after Phase 10.

---

## Quick reference — common operations after migration

**SSH in**:
```bash
ssh -i ~/.ssh/soperfect_ed25519 deploy@<IPV4>
```

**View logs**:
```bash
cd ~/apps/budget-share-app
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web
```

**Deploy a new code version**:
```bash
cd ~/apps/budget-share-app
git pull --rebase
docker compose -f docker-compose.prod.yml up -d --build
```

**Restart everything**:
```bash
docker compose -f docker-compose.prod.yml restart
```

**Open MySQL shell**:
```bash
docker compose -f docker-compose.prod.yml exec mysql mysql -u root -p budget_app
```

**Check disk usage**:
```bash
df -h
docker system df
docker system prune -af   # if disk is filling with old images
```

**Restore from latest backup**:
```bash
gunzip < /home/deploy/backups/budget-$(date +%F).sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T mysql mysql -u root -p"<root-pwd>" budget_app
```

---

## Pre-flight checklist

Tick these off before you start Phase 1:

- [ ] You have an SSH key pair (or are willing to generate one in Phase 1).
- [ ] Your `main` branch on GitHub contains the Caddy changes from Phase 3 (or you're prepared to push them).
- [ ] You have a password manager open to record secrets generated in Phase 4.
- [ ] You have punktum.dk login credentials handy.
- [ ] You've taken one final FTP/SFTP snapshot of the current one.com content (even if you're discarding it).
- [ ] You can tolerate the live site being down for an hour or two during Phase 7.

When all six are green, start at Phase 1. Total elapsed time on a single afternoon is realistic.
