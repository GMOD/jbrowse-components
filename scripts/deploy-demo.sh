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
# Usage: scripts/deploy-demo.sh <local-file> <demos-relative-path>
#   scripts/deploy-demo.sh config.json grape_peach_cacao/config.json
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 <local-file> <demos-relative-path>" >&2
  echo "  e.g. $0 config.json grape_peach_cacao/config.json" >&2
  exit 1
fi

local_file="$1"
demo_path="$2"
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
