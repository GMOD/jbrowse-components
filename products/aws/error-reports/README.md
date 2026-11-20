# JBrowse error reports

The **Send report** button in JBrowse's error dialog posts the report it shows,
with the user's optional note and email address, to
`https://api.jbrowse.org/errors/v1/report`. This Lambda mails it to
jbrowse2@berkeley.edu from error-reports@jbrowse.org, with the user's address as
Reply-To, so answering the mail answers the user. Each report is also logged to
`/aws/lambda/jbrowse-error-reports` for a year.

`src/email.mjs` builds the mail and is tested by `node --test email.test.mjs`;
`src/index.mjs` sends it through SES. The runtime provides the AWS SDK, so there
is nothing to install or build.

## Deploy

Needs the SAM CLI and credentials for the JBrowse account.

```bash
./deploy.sh
```

The API mounts at `errors/v1` on `api.jbrowse.org`, a domain the
`jbrowse-blat-proxy` stack owns. SES already verifies the `jbrowse.org` domain
the mail is sent from. `TO_ADDRESS=you@example.org ./deploy.sh` points the mail
somewhere else, for a test.

The endpoint is public and every accepted request becomes a mail. The stage
accepts one request a second with a burst of five, and the function runs at most
two at a time.
