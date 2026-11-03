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
