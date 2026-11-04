#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# ./deploy.sh                      dual-write: Firehose and DynamoDB
# WRITE_DYNAMO=false ./deploy.sh   cutover: Firehose only

REGION="${AWS_REGION:-us-east-1}"
STACK="${STACK_NAME:-jbrowse-analytics}"
FUNCTION="${FUNCTION_NAME:-jbrowse-analytics}"
WRITE_DYNAMO="${WRITE_DYNAMO:-true}"

aws cloudformation deploy \
  --stack-name "$STACK" \
  --region "$REGION" \
  --template-file template.yaml \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset

output() {
  aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey==\`$1\`].OutputValue" --output text
}

BUNDLE="$(mktemp -d)/function.zip"
zip -q -j "$BUNDLE" index.mjs

# The old code needs the nodejs12.x runtime and the new code needs nodejs24.x,
# so pings fail for the few seconds between these two updates.
aws lambda update-function-configuration \
  --function-name "$FUNCTION" \
  --region "$REGION" \
  --runtime nodejs24.x \
  --handler index.handler \
  --environment "Variables={JB1_STREAM=$(output Jb1Stream),JB2_STREAM=$(output Jb2Stream),WRITE_DYNAMO=$WRITE_DYNAMO}" \
  >/dev/null
aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION"
aws lambda update-function-code \
  --function-name "$FUNCTION" \
  --region "$REGION" \
  --zip-file "fileb://$BUNDLE" \
  >/dev/null
aws lambda wait function-updated --function-name "$FUNCTION" --region "$REGION"

echo "Deployed. Events land in s3://$(output ArchiveBucket)/events/ (WRITE_DYNAMO=$WRITE_DYNAMO)"
