# Azure VM deployment

Use an active Azure for Students subscription with available credit and a spending limit. Verify VM, disk, IP, and outbound networking costs before creating resources. This deployment consumes credits and is not permanently free.

## VM configuration

Use a supported Ubuntu LTS image and an available x86-64 size with enough memory for Elasticsearch plus the app and database (prefer 8 GB RAM). Assign a static public IP and Azure DNS label. Allow public HTTP/HTTPS ports 80/443; restrict SSH to the administrator's current IP. Do not expose 4000, 5432, 6379, or 9200. Install Docker Engine and Compose using Docker's official Ubuntu instructions. Set the Elasticsearch host requirement with `sudo sysctl -w vm.max_map_count=262144` and persist that setting across reboots.

## Application

Clone the private repository securely without placing an access token in the remote URL. From the repository root:

```sh
cp .env.production.example .env.production
chmod 600 .env.production
```

Populate the file locally on the VM with real OAuth credentials, randomly generated session/encryption keys and a hexadecimal PostgreSQL password. Set APP_DOMAIN to the VM's Azure DNS hostname, without a scheme or path. Fresh databases have no local user or sender records. Keep the original encryption key only if restoring existing encrypted data.

```sh
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml up -d --wait postgres redis elasticsearch
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps web node backend/dist/scripts/migrate.js
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps web node backend/dist/scripts/search-init.js
docker compose --env-file .env.production -f compose.production.yaml up -d --wait
```

Caddy obtains HTTPS certificates when DNS resolves to the VM and ports 80/443 are reachable. Database services have no published host ports. The web app and worker run independently and restart after a reboot while named volumes retain data. Do not use `down -v` on retained data.

## OAuth and acceptance

Register `https://<APP_DOMAIN>` as the Google JavaScript origin, `https://<APP_DOMAIN>/auth/google/callback` as the Google redirect, and `https://<APP_DOMAIN>/api/integrations/slack/callback` as the Slack redirect. Complete real sign-in and Slack channel consent from that same origin.

Verify public HTTPS, private API rejection when signed out, Google login/logout, CSV scheduling, worker restart recovery, Elasticsearch search, Ethereal SMTP port 587 connectivity and previews. Sending a live Slack test requires channel-owner approval. Monitor credit consumption; deleting an unused deployment requires removing its disks and public IP as well as the VM. Back up data before removing resources.

## Automatic deployment

The production VM checks the repository's `main` branch every minute using its read-only GitHub deploy key. A push is normally detected within 70 seconds; the Docker build adds deployment time. This is a systemd timer on the VM, not a GitHub Actions workflow. The VM must remain running.

The administrator-installed `/usr/local/sbin/reachflow-auto-deploy` creates a separate source release, builds the image while the existing app runs, backs up PostgreSQL, runs migrations and search initialization, and switches the Compose services. Deployments are serialized. Production environment variables remain in `/opt/reachflow/.env.production`; named database and queue volumes are retained. A startup failure attempts to restore the previous application release. Database migrations are not automatically reverted and must remain backward compatible. Changes may cause a brief restart of the web app and worker.

The timer only accepts fast-forward updates, stops on local checkout changes, and skips a failed commit until another push or a manual retry. Build and migration failures appear in the service journal. Release directories, images, and private PostgreSQL backups remain on the VM; monitor disk usage and remove obsolete artifacts after confirming the current release and backups are usable.

```sh
# Inspect deployment status and logs
sudo cat /var/lib/reachflow-deploy/status
sudo systemctl list-timers reachflow-deploy.timer
sudo journalctl -u reachflow-deploy.service -n 100 --no-pager

# Retry the latest main revision manually
sudo /usr/local/sbin/reachflow-auto-deploy --force

# Pause future automatic deployments (does not stop the app or an active deployment)
sudo systemctl disable --now reachflow-deploy.timer

# Resume automatic deployment
sudo systemctl enable --now reachflow-deploy.timer
```

For a new VM, after completing the initial deployment and setting up the read-only Git remote, install the deployment controller as an administrator:

```sh
sudo install -m 0755 deploy/auto-deploy.sh /usr/local/sbin/reachflow-auto-deploy
sudo install -m 0644 deploy/systemd/reachflow-deploy.service /etc/systemd/system/
sudo install -m 0644 deploy/systemd/reachflow-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now reachflow-deploy.timer
sudo systemctl start reachflow-deploy.service
```

Only trusted contributors should be allowed to push or merge to `main`, because those commits are deployed to production. The controller and systemd units are deliberately installed outside the checkout: updates to those files require administrator review and reinstallation.
