#!/usr/bin/env bash
# Upload a file to the jbrowse.org demos area and invalidate the CloudFront
# cache for its path, in one step.
#
# Uploading with `aws s3 cp` alone is not enough: CloudFront (distribution
# E13LGELJOT4GQO, which fronts jbrowse.org / www.jbrowse.org) keeps serving the
# previously-cached object for hours, so the app and the screenshot generator
# load the *old* file — e.g. a synteny demo errors with "Could not resolve
# identifier <newTrackId>" because the cached config predates the new track.
# Invalidating the exact path right after upload avoids that footgun.
#
# Replacing an object whose SIZE changed is broken for about a minute after the
# invalidation, rather than merely stale: edges serve byte ranges of the old
# object against the new one, so a range-requested format tears. samtools calls
# that "[E::bgzf_read] Read block operation failed", which reads like a corrupt
# upload and is not one -- re-check before re-uploading. Wait for a real query
# to succeed:
#
#   until samtools view -c <url> <region> >/dev/null 2>&1; do sleep 20; done
#
# A config that has a checked-in copy under demos/ must be deployed FROM that
# copy. Uploading a config assembled in a scratch directory is how
# ecoli_pangenome lost its `ecoli_ava` track: nothing in review saw the
# deletion, and the bucket has no versioning to restore from. Edit
# demos/<path>, commit, then deploy. DEPLOY_DEMO_ALLOW_UNTRACKED=1 overrides,
# for a one-off asset that genuinely has no repo copy.
#
# Usage: scripts/deploy-demo.sh <local-file> <demos-relative-path>
#   scripts/deploy-demo.sh demos/grape_peach_cacao/config.json grape_peach_cacao/config.json
#   scripts/deploy-demo.sh grape_peach_cacao/config.json    # same, path inferred
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "usage: $0 [<local-file>] <demos-relative-path>" >&2
  echo "  e.g. $0 grape_peach_cacao/config.json" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "$0")/.." && pwd)"

if [ "$#" -eq 1 ]; then
  demo_path="$1"
  local_file="$repo_root/demos/$demo_path"
  if [ ! -f "$local_file" ]; then
    echo "no repo copy at demos/$demo_path — pass the local file explicitly" >&2
    exit 1
  fi
else
  local_file="$1"
  demo_path="$2"
fi

tracked="$repo_root/demos/$demo_path"
if [ -f "$tracked" ] && ! cmp -s "$local_file" "$tracked"; then
  echo "refusing: $local_file differs from the checked-in demos/$demo_path" >&2
  echo "  edit and commit demos/$demo_path, then deploy that — or set" >&2
  echo "  DEPLOY_DEMO_ALLOW_UNTRACKED=1 to override." >&2
  [ "${DEPLOY_DEMO_ALLOW_UNTRACKED:-}" = "1" ] || exit 1
  echo "  DEPLOY_DEMO_ALLOW_UNTRACKED=1 set, continuing" >&2
fi

distribution_id="E13LGELJOT4GQO" # jbrowse.org / www.jbrowse.org
s3_key="demos/${demo_path}"

content_type=""
case "$local_file" in
  *.json) content_type="application/json" ;;
esac

echo "Uploading $local_file -> s3://jbrowse.org/$s3_key"
if [ -n "$content_type" ]; then
  aws s3 cp "$local_file" "s3://jbrowse.org/$s3_key" --content-type "$content_type"
else
  aws s3 cp "$local_file" "s3://jbrowse.org/$s3_key"
fi

echo "Invalidating CloudFront /$s3_key"
aws cloudfront create-invalidation \
  --distribution-id "$distribution_id" \
  --paths "/$s3_key" \
  --query 'Invalidation.{Id:Id,Status:Status}' \
  --output table
