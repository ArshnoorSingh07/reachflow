#!/usr/bin/env bash
set -euo pipefail
# Run as root on a fresh Ubuntu VM. Uses Docker's official apt repository.
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this script with sudo.' >&2
  exit 1
fi
. /etc/os-release
if [ "$ID" != ubuntu ]; then
  echo 'This bootstrap supports Ubuntu only.' >&2
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<SOURCES
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
SOURCES
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
printf 'vm.max_map_count=262144\n' > /etc/sysctl.d/99-reachflow.conf
sysctl --system
install -d -m 0750 -o azureuser -g azureuser /opt/reachflow
docker --version
docker compose version
