#!/usr/bin/env bash
# Installed outside the checkout; only a trusted administrator should update this file.
set -Eeuo pipefail
umask 077
repo=/opt/reachflow
state=/var/lib/reachflow-deploy
releases=/opt/reachflow-releases
env_file="$repo/.env.production"
mkdir -p "$state" "$state/backups" "$releases"
exec 9>"$state/deploy.lock"
flock -n 9 || exit 0
force=${1:-}
git_repo() { sudo -u azureuser git -C "$repo" "$@"; }
compose() {
  docker compose --project-directory "$1" --env-file "$env_file" \
    -f "$1/compose.production.yaml" -f "$2" "${@:3}"
}
write_image() {
  printf 'services:\n  web:\n    image: %s\n  worker:\n    image: %s\n' "$2" "$2" > "$1"
}
# A failed revision waits for the next push, rather than rebuilding every minute.
git_repo fetch --prune origin main
target=$(git_repo rev-parse origin/main)
if [[ "$force" != --force ]]; then
  [[ ! -f "$state/deployed-commit" || $(cat "$state/deployed-commit") != "$target" ]] || exit 0
  [[ ! -f "$state/failed-commit" || $(cat "$state/failed-commit") != "$target" ]] || exit 0
fi
[[ -z $(git_repo status --porcelain) ]] || { echo 'Checkout has local changes; deployment stopped.' >&2; exit 1; }
git_repo merge-base --is-ancestor HEAD "$target" || { echo 'main was rewritten; manual review required.' >&2; exit 1; }
# Production secrets must never be tracked by a pushed revision.
if git_repo cat-file -e "$target:.env.production" 2>/dev/null || git_repo cat-file -e "$target:.env" 2>/dev/null; then
  echo 'Refusing a revision containing a real environment file.' >&2; exit 1
fi
release="$releases/$target"
override="$state/image-$target.yaml"
previous=$(cat "$state/current-release" 2>/dev/null || printf '%s' "$repo")
previous_override="$state/rollback-image.yaml"
old_container=$(docker ps -q --filter label=com.docker.compose.project=reachflow-production --filter label=com.docker.compose.service=web)
[[ -n "$old_container" ]] || { echo 'No running web container; manual recovery required.' >&2; exit 1; }
old_image=$(docker inspect --format '{{.Image}}' "$old_container")
docker image tag "$old_image" reachflow:previous
write_image "$previous_override" reachflow:previous
switched=0
on_error() {
  code=$?
  trap - ERR
  printf '%s\n' "$target" > "$state/failed-commit"
  printf 'Failed %s at %s\n' "$target" "$(date -u +%FT%TZ)" > "$state/status"
  if [[ "$switched" == 1 ]]; then
    echo 'Restoring previous application release. Database changes are not automatically reverted.' >&2
    compose "$previous" "$previous_override" up -d --no-build --wait --wait-timeout 180 || echo 'ROLLBACK FAILED: administrator action required' >&2
  fi
  exit "$code"
}
trap on_error ERR
echo "Deploying $target"
printf 'Building %s at %s\n' "$target" "$(date -u +%FT%TZ)" > "$state/status"
if [[ ! -d "$release" ]]; then
  staging=$(mktemp -d "$releases/.staging-XXXXXXXX")
  git_repo archive "$target" | tar -x -C "$staging"
  mv "$staging" "$release"
fi
# The secret stays outside each release and out of Docker's build context.
ln -sfn "$env_file" "$release/.env.production"
write_image "$override" "reachflow:git-$target"
compose "$release" "$override" config --quiet
compose "$release" "$override" build web
# Snapshot the live DB before running migrations. Never restore it automatically.
backup="$state/backups/$(date -u +%Y%m%dT%H%M%SZ)-${target:0:12}.dump"
compose "$previous" "$previous_override" exec -T postgres pg_dump -U reachflow -d reachflow -Fc > "$backup"
test -s "$backup"
compose "$release" "$override" run --rm --no-deps web node backend/dist/scripts/migrate.js
compose "$release" "$override" run --rm --no-deps web node backend/dist/scripts/search-init.js
switched=1
compose "$release" "$override" up -d --no-build --wait --wait-timeout 180
compose "$release" "$override" exec -T web node -e "fetch('http://127.0.0.1:4000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
# Keep the admin checkout current only after the new release is healthy.
git_repo merge --ff-only "$target"
printf '%s\n' "$release" > "$state/current-release"
printf '%s\n' "$target" > "$state/deployed-commit"
if [[ -f "$state/failed-commit" ]]; then : > "$state/failed-commit"; fi
printf 'Deployed %s at %s\n' "$target" "$(date -u +%FT%TZ)" > "$state/status"
echo "Deployment healthy: $target"
