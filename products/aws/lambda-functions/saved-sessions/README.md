# Share-link service

The `share` and `load` endpoints behind a short link (`configuration.shareURL`,
default `https://share.jbrowse.org/api/v1/`).

- **`save-session-jbrowse`** stores an encrypted session and answers its id. It
  takes the id the client offers (a hash of the link's key) when one is well
  formed, so the link needs only the key.
- **`read-session-jbrowse`** answers the stored session for an id.
- Neither ever sees a key; the browser decrypts.

## Deploying

Both run in `us-east-1` behind API Gateway, as Lambda functions of those names,
with `sessionTable` naming the DynamoDB table. Each zip holds the function as
`index.js` (handler `index.handler`), plus `multipart.js` for the save function.
They use the AWS SDK v3 that the `nodejs22.x` runtime includes.

```bash
mkdir -p /tmp/save && cp save-session-jbrowse.js /tmp/save/index.js
cp multipart.js /tmp/save/ && (cd /tmp/save && zip save.zip index.js multipart.js)
aws lambda update-function-configuration --region us-east-1 \
  --function-name save-session-jbrowse --runtime nodejs22.x
aws lambda update-function-code --region us-east-1 \
  --function-name save-session-jbrowse --zip-file fileb:///tmp/save/save.zip
```

`read-session-jbrowse` goes up the same way, without `multipart.js`.
