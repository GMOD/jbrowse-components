#!/usr/bin/env bash
set -euo pipefail

FROM_EMAIL="${1:-}"
if [[ -z "$FROM_EMAIL" ]]; then
  echo "Usage: ./deploy.sh <from-email>"
  echo "  e.g. ./deploy.sh jbrowse2@berkeley.edu"
  exit 1
fi

STACK="jbrowse-newsletter"
REGION="us-east-1"

sam build

echo "==> Pass 1: creating stack (API_URL empty)..."
sam deploy \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --region "$REGION" \
  --parameter-overrides "FromEmail=$FROM_EMAIL ApiBaseUrl=" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text)

echo "==> API URL: $API_URL"

echo "==> Pass 2: setting API_URL in Lambda env..."
sam deploy \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --region "$REGION" \
  --parameter-overrides "FromEmail=$FROM_EMAIL ApiBaseUrl=$API_URL" \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset

echo ""
echo "Done! Add this to website/.env:"
echo "PUBLIC_NEWSLETTER_API_URL=$API_URL"
