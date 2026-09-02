#!/bin/bash

set -e

# us-east-1 is where the rest of the JBrowse infrastructure lives (the website
# buckets, the jb2hubs config-merger) and where the *.jbrowse.org certificate is
# issued. An HTTP API custom domain is REGIONAL, so its certificate has to be in
# the same region as the API — deploying elsewhere means issuing another one.
REGION="${AWS_REGION:-us-east-1}"

# The key lives in SSM Parameter Store, not in anyone's shell history: a
# redeploy for a code change (a new route, a dependency bump) then needs no
# secret in hand, and rotating the key is one put-parameter followed by a
# deploy. UCSC_API_KEY in the environment overrides it, which is also how the
# parameter was first seeded.
KEY_PARAMETER="${KEY_PARAMETER:-/jbrowse/blat-proxy/ucsc-api-key}"
if [ -z "$UCSC_API_KEY" ]; then
  UCSC_API_KEY=$(aws ssm get-parameter --region "$REGION" --name "$KEY_PARAMETER" \
    --with-decryption --query Parameter.Value --output text) || {
    echo "No UCSC_API_KEY in the environment and none at SSM $KEY_PARAMETER" >&2
    echo "(UCSC account -> Hub Development -> API key; store it with" >&2
    echo " aws ssm put-parameter --name $KEY_PARAMETER --type SecureString --value ...)" >&2
    exit 1
  }
fi

# The production deployment, so that a plain ./deploy.sh updates what
# api.jbrowse.org serves. Set DOMAIN_NAME= (empty) for a deployment with no
# domain, which answers on the generated execute-api hostname instead.
DOMAIN_NAME="${DOMAIN_NAME-api.jbrowse.org}"
CERTIFICATE_ARN="${CERTIFICATE_ARN-arn:aws:acm:us-east-1:410987773811:certificate/620d3f82-95d4-47e4-aec4-d8730b2837c2}"
HOSTED_ZONE_ID="${HOSTED_ZONE_ID-ZCCQDWJ8N0J2D}"

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
