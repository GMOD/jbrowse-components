#!/bin/bash

set -e

if [ -z "$UCSC_API_KEY" ]; then
  echo "UCSC_API_KEY env var is required (UCSC account -> Hub Development -> API key)" >&2
  exit 1
fi

# us-east-1 is where the rest of the JBrowse infrastructure lives (the website
# buckets, the jb2hubs config-merger) and where the *.jbrowse.org certificate is
# issued. An HTTP API custom domain is REGIONAL, so its certificate has to be in
# the same region as the API — deploying elsewhere means issuing another one.
REGION="${AWS_REGION:-us-east-1}"

# Empty by default: a deployment with no domain still works, it just answers on
# the generated execute-api hostname.
DOMAIN_NAME="${DOMAIN_NAME:-}"
CERTIFICATE_ARN="${CERTIFICATE_ARN:-}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID:-}"

echo "Building bundle..."
pnpm build

echo "Building SAM application..."
sam build

echo "Deploying to AWS ($REGION)..."
# Fully specified rather than relying on `sam deploy --guided` writing a
# samconfig.toml: the stack name and the IAM capability are properties of this
# template, not of whoever runs it, and --resolve-s3 saves managing a bucket.
sam deploy \
  --stack-name "${STACK_NAME:-jbrowse-blat-proxy}" \
  --region "$REGION" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --no-confirm-changeset \
  --parameter-overrides \
    "UcscApiKey=$UCSC_API_KEY" \
    "DomainName=$DOMAIN_NAME" \
    "CertificateArn=$CERTIFICATE_ARN" \
    "HostedZoneId=$HOSTED_ZONE_ID"

echo "Deployment complete. Point the plugin's BLAT server URL at the BlatProxyApiUrl output above."
