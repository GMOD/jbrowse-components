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
sam deploy --parameter-overrides "UcscApiKey=$UCSC_API_KEY"

echo "Deployment complete. Point the plugin's BLAT server URL at the BlatProxyApiUrl output above."
