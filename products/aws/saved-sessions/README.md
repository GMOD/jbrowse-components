# Share-link service

The `share` and `load` endpoints behind a short link (`configuration.shareURL`,
default `https://share.jbrowse.org/api/v1/`).

- **`save-session-jbrowse`** (`src/save.mjs`) stores an encrypted session and
  answers its id. It takes the id the client offers (a hash of the link's key)
  when one is well formed, so the link needs only the key. Each id is written
  once, and a session over 350 KB is refused with a message pointing at a long
  link.
- **`read-session-jbrowse`** (`src/read.mjs`) answers the stored session for an
  id.
- Neither ever sees a key; the browser decrypts.

`src/sessions.mjs` holds what both do apart from DynamoDB, and is tested by
`node --test`. The runtime provides the AWS SDK, so there is nothing to install
or build.

## Deploy

Needs the AWS CLI, `zip` and credentials for the JBrowse account.

```bash
./deploy.sh
```

It runs the tests, updates both functions in `us-east-1` and throttles the share
route, then checks the live endpoints with two requests that write nothing.

- The functions, the `jbrowse-sessions` HTTP API (`API_ID`) and the
  `JB2_saved_sessions` table predate any stack and stay outside one. Each
  function reads the table's name from its `sessionTable` variable.
- The share route takes one request a second with a burst of five.
- **Never scan `JB2_saved_sessions`.** Its capacity is provisioned at five read
  and five write units, so a scan throttles and takes capacity from live loads.
  Find a row by its id.
