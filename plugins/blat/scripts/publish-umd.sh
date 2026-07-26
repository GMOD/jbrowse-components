#!/usr/bin/env bash
# Build and publish the UMD bundle to jbrowse.org, under a versioned path.
#
# Why versioned, when the other jbrowse.org-hosted plugins are not: this URL
# gets written into hub configs (jb2hubs stamps it into every generated
# config.json), and those configs are regenerated on their own schedule, not
# ours. An unversioned URL means any future bundle is loaded by every config
# already published — so a change that needs a newer JBrowse than some host is
# running takes that host down, with no way to pin the old behavior. Same
# reasoning as the /ucsc/v1 path on the API.
#
#   v1 receives compatible updates — bug fixes, new UI, anything that still runs
#   on the hosts already loading it. Those SHOULD reach existing configs.
#
#   Mint v2 when the plugin starts requiring something of the host that v1 did
#   not, and leave v1 in place answering older configs.
#
# Uploading with `aws s3 cp` alone is not enough: CloudFront (E13LGELJOT4GQO,
# fronting jbrowse.org) serves the previously-cached object for hours, so the
# invalidation is part of publishing rather than a thing to remember after.
#
# Usage: plugins/blat/scripts/publish-umd.sh [version]   (default v1)
set -euo pipefail

version="${1:-v1}"
distribution_id="E13LGELJOT4GQO" # jbrowse.org / www.jbrowse.org
bundle=jbrowse-plugin-blat.umd.production.min.js
s3_dir="s3://jbrowse.org/plugins/jbrowse-plugin-blat/dist/${version}"
here="$(cd "$(dirname "$0")/.." && pwd)"

cd "$here"
pnpm build:umd

aws s3 cp "dist/${bundle}" "${s3_dir}/" --content-type application/javascript
aws s3 cp "dist/${bundle}.map" "${s3_dir}/" --content-type application/json
aws cloudfront create-invalidation \
  --distribution-id "$distribution_id" \
  --paths "/plugins/jbrowse-plugin-blat/dist/${version}/*" \
  --query 'Invalidation.Id' --output text

echo "published https://jbrowse.org/plugins/jbrowse-plugin-blat/dist/${version}/${bundle}"
