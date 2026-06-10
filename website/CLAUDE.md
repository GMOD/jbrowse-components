# Website

Astro static site deployed to `s3://jbrowse.org/jb2/` via GitHub Actions on
commits to `main` containing "update docs".

## Newsletter

Subscription form (`src/components/NewsletterSignup.tsx`) calls the AWS Lambda
API at `PUBLIC_NEWSLETTER_API_URL`. Infrastructure lives in
`infrastructure/newsletter/` (SAM stack: Lambda + DynamoDB + SES). Sender is
`newsletter@jbrowse.org` (DKIM verified in SES). The API URL is set as a GitHub
Actions secret and in `website/.env` for local dev. To send a newsletter, invoke
the `jbrowse-newsletter-send` Lambda directly via AWS CLI (see
`infrastructure/newsletter/README.md`).
