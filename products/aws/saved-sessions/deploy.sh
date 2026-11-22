#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

REGION="${AWS_REGION:-us-east-1}"
API_ID="${API_ID:-g5um1mrb0i}"
ENDPOINT="${ENDPOINT:-https://share.jbrowse.org/api/v1}"

node --test

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

# Each function's handler is its own file under the name both are configured
# with, index.handler, so new code goes live without a configuration change
deploy() {
  local dir="$BUILD/$1"
  mkdir -p "$dir"
  cp src/sessions.mjs "$dir/"
  cp "src/$2" "$dir/index.mjs"
  (cd "$dir" && zip -q function.zip index.mjs sessions.mjs)
  aws lambda update-function-code --region "$REGION" --function-name "$1" \
    --zip-file "fileb://$dir/function.zip" >/dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$1"
  aws lambda update-function-configuration --region "$REGION" \
    --function-name "$1" --runtime nodejs24.x >/dev/null
  aws lambda wait function-updated --region "$REGION" --function-name "$1"
}
deploy save-session-jbrowse save.mjs
deploy read-session-jbrowse read.mjs

# The endpoint is public and every accepted share is a row kept for good, so
# the stage sheds a flood before it reaches the table
aws apigatewayv2 update-stage --region "$REGION" --api-id "$API_ID" \
  --stage-name '$default' \
  --route-settings '{"POST /api/v1/share":{"ThrottlingRateLimit":1,"ThrottlingBurstLimit":5}}' \
  >/dev/null

# Checks that write nothing: a load of an id nothing is stored under, and a
# share over DynamoDB's own item limit, which only the new code answers with 413
expect() {
  local want="$1"
  shift
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' "$@")"
  if [[ "$got" != "$want" ]]; then
    echo "expected $want, got $got: $*" >&2
    exit 1
  fi
}
expect 404 "$ENDPOINT/load?sessionId=deploy-check-nothing-here"
head -c 410000 /dev/zero | tr '\0' a >"$BUILD/oversized"
expect 413 -F "session=<$BUILD/oversized" "$ENDPOINT/share"

echo "Deployed save-session-jbrowse and read-session-jbrowse to $ENDPOINT"
