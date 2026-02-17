#!/usr/bin/env bash
set -euo pipefail

# Stream selected GitLab project CI variables into GitHub repo secrets
# without printing secret values.
#
# Prereqs:
# - glab authenticated to the source GitLab instance
# - gh authenticated to GitHub
# - jq available
#
# Usage:
#   lifecycle/migrate-gitlab-ci-vars-to-github-secrets.sh \
#     --gitlab-project episkopos/stoat-frontend \
#     --github-repo episk-pos/stoat-frontend

GITLAB_PROJECT=""
GITLAB_GROUP=""
GITHUB_REPO=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gitlab-project)
      GITLAB_PROJECT="${2:-}"
      shift 2
      ;;
    --github-repo)
      GITHUB_REPO="${2:-}"
      shift 2
      ;;
    --gitlab-group)
      GITLAB_GROUP="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$GITLAB_PROJECT" || -z "$GITHUB_REPO" ]]; then
  echo "Usage: $0 --gitlab-project <group/project> --github-repo <owner/repo> [--gitlab-group <group>]" >&2
  exit 1
fi

for bin in glab gh jq mktemp; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Missing required command: $bin" >&2
    exit 1
  fi
done

declare -a VARS=(
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
  AWS_SESSION_TOKEN
  AWS_REGION
  S3_BUCKET
  CLOUDFRONT_DISTRIBUTION_ID
)

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

for key in "${VARS[@]}"; do
  echo "Migrating $key"

  var_json="$(glab api "projects/${GITLAB_PROJECT//\//%2F}/variables/${key}" 2>/dev/null || true)"
  source_scope="project"
  if [[ -z "$var_json" ]]; then
    if [[ -n "$GITLAB_GROUP" ]]; then
      var_json="$(glab api "groups/${GITLAB_GROUP//\//%2F}/variables/${key}" 2>/dev/null || true)"
      source_scope="group"
    fi
  fi
  if [[ -z "$var_json" ]]; then
    echo "  - skipped (not found in GitLab project/group variables)" >&2
    continue
  fi

  if ! jq -e '.key and .value' >/dev/null <<<"$var_json"; then
    echo "  - error: GitLab API response was not a variable object" >&2
    echo "    check glab host/auth/project path and retry" >&2
    exit 1
  fi

  secret_file="$tmpdir/$key"
  if ! jq -r '.value' <<<"$var_json" >"$secret_file"; then
    echo "  - error: failed to extract value for $key" >&2
    exit 1
  fi

  if ! gh secret set "$key" --repo "$GITHUB_REPO" <"$secret_file"; then
    echo "  - error: failed to set GitHub secret $key" >&2
    exit 1
  fi
  echo "  - set from GitLab ${source_scope} variables"

  : >"$secret_file"
  rm -f "$secret_file"
done

echo "Done. Selected GitLab CI variables were streamed to GitHub secrets."

# Optional follow-up: if expected keys were not in project variables, check group variables.
# Example (list keys only, no values):
#   glab api "groups/<group>/variables" | jq -r '.[].key'
