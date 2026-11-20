#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

sam deploy \
  --template-file template.yaml \
  --stack-name "${STACK_NAME:-jbrowse-error-reports}" \
  --region "${AWS_REGION:-us-east-1}" \
  --capabilities CAPABILITY_IAM \
  --resolve-s3 \
  --no-fail-on-empty-changeset \
  --no-confirm-changeset \
  --parameter-overrides "ToAddress=${TO_ADDRESS:-jbrowse2@berkeley.edu}"
