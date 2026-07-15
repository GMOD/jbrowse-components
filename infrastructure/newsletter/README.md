# JBrowse Newsletter Infrastructure

AWS Lambda + DynamoDB + SES stack for the jbrowse.org release newsletter.

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) configured with your account
- [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Node.js 22+

## One-time SES setup

Before deploying, verify the sender address in SES:

```bash
aws ses verify-email-identity --email-address newsletter@jbrowse.org
```

Check your inbox for the verification link. If you want to verify the whole
`jbrowse.org` domain instead, use the SES console → Verified identities → Create
identity.

SES starts in **sandbox mode** — you can only send to verified addresses. To
send to arbitrary subscribers, request production access via the SES console:
Support → Create case → Service limit increase → SES Sending Limits.

## Deploy

```bash
cd infrastructure/newsletter
npm install
sam build
sam deploy --guided
```

Answer the prompts. When asked for parameters:

- **FromEmail** — the verified SES address (e.g. `newsletter@jbrowse.org`)
- **AllowedOrigins** — leave default or adjust if your domain differs

SAM saves answers to `samconfig.toml` so subsequent deploys just need:

```bash
sam build && sam deploy
```

After deploying, the stack outputs will print the API URL. Copy it.

## Wire up the website

Add the API URL to `website/.env`:

```
PUBLIC_NEWSLETTER_API_URL=https://XXXXXXXXXX.execute-api.us-east-1.amazonaws.com
```

If you deploy via GitHub Actions, add `PUBLIC_NEWSLETTER_API_URL` as a
repository secret and expose it in the build step:

```yaml
- name: Build website
  env:
    PUBLIC_NEWSLETTER_API_URL: ${{ secrets.PUBLIC_NEWSLETTER_API_URL }}
  run: cd website && npm run build
```

## Sending a newsletter

Invoke the send Lambda directly with the AWS CLI — no public endpoint is
exposed:

```bash
aws lambda invoke \
  --function-name jbrowse-newsletter-send \
  --payload '{"subject":"JBrowse 3.1 Released","htmlBody":"<h1>JBrowse 3.1</h1><p>...</p>","textBody":"JBrowse 3.1\n\n..."}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

The response contains `{ sent, skipped, errors }`.

Use `"dryRun": true` to see subscriber count without sending:

```bash
aws lambda invoke \
  --function-name jbrowse-newsletter-send \
  --payload '{"subject":"test","htmlBody":"test","dryRun":true}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

Each email automatically gets a personalized unsubscribe link appended.

## Viewing subscribers

```bash
aws dynamodb scan \
  --table-name jbrowse-newsletter-subscribers \
  --filter-expression "#s = :confirmed" \
  --expression-attribute-names '{"#s":"status"}' \
  --expression-attribute-values '{":confirmed":{"S":"confirmed"}}' \
  --query "Items[*].email.S"
```

## Teardown

```bash
sam delete --stack-name jbrowse-newsletter
```
