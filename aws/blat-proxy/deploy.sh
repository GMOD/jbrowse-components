#!/bin/bash

set -e

if [ -z "$UCSC_API_KEY" ]; then
  echo "UCSC_API_KEY env var is required (UCSC account -> Hub Development -> API key)" >&2
  exit 1
fi

echo "Building bundle..."
pnpm build

echo "Building SAM application..."
sam build

echo "Deploying to AWS..."
# Fully specified rather than relying on `sam deploy --guided` writing a
# samconfig.toml: the stack name and the IAM capability are properties of this
# template, not of whoever runs it, and --resolve-s3 saves managing a bucket.
sam deploy \
  --stack-name "${STACK_NAME:-jbrowse-blat-proxy}" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --no-confirm-changeset \
  --parameter-overrides "UcscApiKey=$UCSC_API_KEY"

echo "Deployment complete. Point the plugin's BLAT server URL at the BlatProxyApiUrl output above."
