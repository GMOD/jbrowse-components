---
title: Putting JBrowse Web behind a login
description:
  Recipes for password-protecting JBrowse Web and its data with HTTP Basic auth,
  institutional single sign-on, AWS Cognito, Google IAP and Firebase
  Authentication, or the login of a web app that embeds JBrowse
guide_category: Deployment
---

JBrowse Web is a folder of static files that reads your data files over HTTP, so
the web server decides who sees a dataset. To keep one private, serve the app,
`config.json` and the data from one site, and put that whole site behind a
login. Once the user signs in, the browser attaches the login (a session cookie
or HTTP Basic credentials) to every request on that site by itself, including
the range requests JBrowse's workers make for BAM, CRAM and other indexed files,
so `config.json` stays an ordinary config with the data's plain URLs in it. The
recipes below differ in who checks the login.

## Rules that apply to every recipe

- **Protect the data folder too.** The browser downloads `config.json`, so every
  file URL in it is visible to anyone who can open the app; a login in front of
  the app alone protects nothing.
- **Leaving a track out of `config.json` protects nothing**, for the same
  reason. Give a group that should see different tracks its own config and data
  folder behind its own access rule (see
  [Different tracks for different groups](#different-tracks-for-different-groups)).
- **Never put a password, token or API key in `config.json`.**
- **Serve over HTTPS**, so the password or session cookie never crosses the
  network in the clear.
- **Keep the app and the data on one origin**, the same scheme, host and port.
  Browsers send a site's cookie only to that site:

| App at                        | Data at                    | Login sent           |
| ----------------------------- | -------------------------- | -------------------- |
| `https://mysite.org/jbrowse/` | `https://mysite.org/data/` | yes                  |
| `https://mysite.org/jbrowse/` | `https://data.mysite.org/` | no, different origin |
| `https://mysite.org/jbrowse/` | an S3 or other bucket URL  | no, different origin |

The layout every recipe below assumes is the folder `npx @jbrowse/cli create`
makes, with the data files copied into a `data/` folder beside `config.json` and
the tracks pointing at them by relative URL (`data/sample.bam`):

```text
jbrowse/
  index.html
  config.json
  static/
  data/
    genome.fa.gz
    sample.bam
    sample.bam.bai
```

## HTTP Basic auth

HTTP Basic auth asks for a username and password in the browser's own dialog,
once per browser session. It needs nothing beyond the web server, and suits a
lab sharing data with a handful of people. Create the password file with
`htpasswd` (in `apache2-utils` on Debian and Ubuntu, `httpd-tools` on Red Hat),
then add each user:

```bash
sudo htpasswd -c /etc/nginx/jbrowse.htpasswd alice   # -c creates the file
sudo htpasswd /etc/nginx/jbrowse.htpasswd bob
```

In nginx, set `auth_basic` on the whole server, so the app and the data share
one realm and the browser reuses the password it was given for both:

```nginx
server {
  listen 443 ssl;
  server_name jbrowse.mylab.org;
  # ssl_certificate lines here
  root /var/www/jbrowse;

  auth_basic "My lab JBrowse";
  auth_basic_user_file /etc/nginx/jbrowse.htpasswd;

  # browsers fetch the web app manifest without credentials
  location = /manifest.json {
    auth_basic off;
  }
}
```

In Apache, a `.htaccess` file in the JBrowse folder does the same (the server
needs `AllowOverride AuthConfig` for that folder):

```apache
AuthType Basic
AuthName "My lab JBrowse"
AuthUserFile /etc/apache2/jbrowse.htpasswd
Require valid-user
```

Browsers have no sign-out button for Basic auth; the login lasts until the
browser is closed.

## Single sign-on with your institution, Google or GitHub

[OAuth2 Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) puts any OpenID
Connect login (an institutional identity provider, Okta, Keycloak, Microsoft
Entra ID) or a Google or GitHub login in front of nginx, and sets a session
cookie on your site. Register an application with the provider, using
`https://jbrowse.mylab.org/oauth2/callback` as its redirect URI, then run the
proxy beside nginx:

```bash
# --upstream=static://202: answer nginx's auth checks only, nginx serves the files
# --email-domain: who may sign in; use --authenticated-emails-file for a list
oauth2-proxy \
  --provider=oidc \
  --oidc-issuer-url=https://login.myinstitution.org \
  --client-id=YOUR_CLIENT_ID \
  --client-secret=YOUR_CLIENT_SECRET \
  --cookie-secret="$(openssl rand -base64 32 | tr -- '+/' '-_')" \
  --email-domain=myinstitution.org \
  --upstream=static://202 \
  --http-address=127.0.0.1:4180 \
  --reverse-proxy=true
```

nginx asks the proxy about each request with `auth_request` and sends a visitor
without a session to the sign-in page:

```nginx
server {
  listen 443 ssl;
  server_name jbrowse.mylab.org;
  root /var/www/jbrowse;

  location /oauth2/ {
    proxy_pass http://127.0.0.1:4180;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Auth-Request-Redirect $request_uri;
  }

  location = /oauth2/auth {
    proxy_pass http://127.0.0.1:4180;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Uri $request_uri;
    proxy_set_header Content-Length "";
    proxy_pass_request_body off;
  }

  location / {
    auth_request /oauth2/auth;
    error_page 401 = /oauth2/sign_in;
  }
}
```

`--provider=google` and `--provider=github` replace the issuer URL for those two
logins; the OAuth2 Proxy docs list the settings each provider takes.

## AWS Cognito

A Cognito user pool holds the user accounts and runs the sign-in page. Which AWS
service checks the login depends on where the files live:

- **The files are in S3** (no servers): CloudFront serves the bucket and a
  Lambda@Edge function checks the Cognito cookie on every request.
- **The files are on servers or containers you run**: an Application Load
  Balancer checks the login itself, with no code.

### CloudFront, S3 and Lambda@Edge

Upload the JBrowse folder, `data/` included, to a private S3 bucket, and serve
it through a CloudFront distribution that reads the bucket with origin access
control. Then:

- In the user pool, add a domain and an app client that uses the authorization
  code grant with the `openid` scope. Its allowed callback and sign-out URLs are
  the distribution's address, such as `https://d1234abcd.cloudfront.net`.
- Create a Lambda function in **us-east-1** (Lambda@Edge runs only functions
  from that region) from the code below, bundled with its `node_modules` after
  `npm install cognito-at-edge`. Lambda@Edge has no environment variables, so
  the pool's settings are written into the code.
- Publish a version of the function and attach it to the distribution's default
  behavior as a **viewer request** trigger, so it runs before CloudFront serves
  any file, cached or not.

```js
const { Authenticator } = require('cognito-at-edge')

const authenticator = new Authenticator({
  region: 'us-east-1', // the user pool's region
  userPoolId: 'us-east-1_EXAMPLE',
  userPoolAppId: 'YOUR_APP_CLIENT_ID',
  userPoolDomain: 'your-domain.auth.us-east-1.amazoncognito.com',
})

exports.handler = async request => authenticator.handle(request)
```

A visitor without a valid cookie goes to the Cognito sign-in page and returns
with the cookie set. The trigger runs for every request, every range request
JBrowse makes for a data file included, so Lambda@Edge bills each one. The
[cognito-at-edge README](https://github.com/awslabs/cognito-at-edge) lists the
options for cookie lifetime and a sign-out URL.

### An Application Load Balancer

When nginx (on EC2 or in ECS) already serves the JBrowse folder, an Application
Load Balancer in front of it can require a Cognito login on its HTTPS listener:

- The user pool's app client **must have a client secret** and use the
  authorization code grant. Its callback URL is
  `https://jbrowse.mylab.org/oauth2/idpresponse`, in lowercase.
- Put the actions below on the listener's default action. The
  `authenticate-cognito` action runs first and the `forward` action sends
  signed-in requests to nginx.

```json
[
  {
    "Type": "authenticate-cognito",
    "Order": 1,
    "AuthenticateCognitoConfig": {
      "UserPoolArn": "arn:aws:cognito-idp:us-east-1:123456789012:userpool/us-east-1_EXAMPLE",
      "UserPoolClientId": "YOUR_APP_CLIENT_ID",
      "UserPoolDomain": "your-domain",
      "Scope": "openid"
    }
  },
  {
    "Type": "forward",
    "Order": 2,
    "TargetGroupArn": "arn:aws:elasticloadbalancing:us-east-1:123456789012:targetgroup/jbrowse/EXAMPLE"
  }
]
```

```bash
aws elbv2 modify-listener --listener-arn YOUR_LISTENER_ARN --default-actions file://actions.json
```

The session lasts seven days unless `SessionTimeout` (in seconds) says
otherwise. The
[ALB authentication guide](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/listener-authenticate-users.html)
covers sign-out and the other settings.

## Google Cloud: Identity-Aware Proxy

Identity-Aware Proxy (IAP) lets in only the Google accounts or Google groups you
name, with no code. Google's own recipe serves a private Cloud Storage bucket
through an nginx container on Cloud Run with IAP in front, which fits JBrowse as
it is. Upload the JBrowse folder to the bucket:

```bash
gcloud storage rsync --recursive ./jbrowse gs://BUCKET_NAME
```

then deploy nginx with the bucket mounted as its web root, following
[Enable IAP for Cloud Storage buckets](https://cloud.google.com/iap/docs/enabling-gcs-cloud-run),
which also creates the service account that reads the bucket:

```bash
gcloud run deploy jbrowse \
  --image=nginx \
  --port=80 \
  --execution-environment=gen2 \
  --service-account=RUN_SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com \
  --add-volume=name=static,type=cloud-storage,bucket=BUCKET_NAME,readonly=true \
  --add-volume-mount=volume=static,mount-path=/usr/share/nginx/html \
  --no-allow-unauthenticated
```

Turn on IAP for the service and grant each person or Google group the
`IAP-secured Web App User` role (`roles/iap.httpsResourceAccessor`). Each file
read is a Cloud Storage call, so a busy site benefits from the caching options
that recipe describes.

## Firebase Authentication

Firebase Authentication signs users in on the page itself, with Google, email
links or the other providers it supports, and leaves the server to check them.
The service below runs on Cloud Run. It turns a Firebase sign-in into a session
cookie, checks the cookie on every request, and serves the JBrowse folder from a
mounted Cloud Storage bucket as in the IAP recipe. Install `express@5`,
`cookie-parser` and `firebase-admin`:

```js
import cookieParser from 'cookie-parser'
import express from 'express'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

initializeApp()
const auth = getAuth()
const twoWeeks = 14 * 24 * 60 * 60 * 1000 // the longest a session cookie lasts
const allowed = new Set(['alice@mylab.org', 'bob@mylab.org'])

const app = express()
app.use(cookieParser())
app.use(express.static('public')) // login.html, served to anyone

app.post('/sessionLogin', express.json(), async (req, res) => {
  const { email } = await auth.verifyIdToken(req.body.idToken)
  if (allowed.has(email)) {
    const cookie = await auth.createSessionCookie(req.body.idToken, {
      expiresIn: twoWeeks,
    })
    // Firebase Hosting forwards only a cookie named __session
    res.cookie('__session', cookie, {
      maxAge: twoWeeks,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    })
    res.end()
  } else {
    res.status(403).end()
  }
})

app.use(async (req, res, next) => {
  try {
    await auth.verifySessionCookie(req.cookies.__session ?? '')
    res.set('Cache-Control', 'private')
    next()
  } catch {
    res.redirect('/login.html')
  }
})
app.use(express.static('/mnt/jbrowse', { cacheControl: false }))

app.listen(process.env.PORT ?? 8080)
```

`public/login.html` signs in with the Firebase web SDK and hands the ID token to
the service. Its config values come from your Firebase project's settings and
are not secrets:

```html
<button>Sign in with Google</button>
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js'
  import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
  } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js'

  const auth = getAuth(
    initializeApp({
      apiKey: 'YOUR_API_KEY',
      authDomain: 'YOUR_PROJECT.firebaseapp.com',
      projectId: 'YOUR_PROJECT',
    }),
  )
  document.querySelector('button').onclick = async () => {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider())
    const res = await fetch('/sessionLogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: await user.getIdToken() }),
    })
    if (res.ok) {
      location.href = '/'
    }
  }
</script>
```

Deploy it from its folder with the bucket mounted where the service reads it:

```bash
gcloud run deploy jbrowse \
  --source=. \
  --execution-environment=gen2 \
  --service-account=RUN_SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com \
  --add-volume=name=jbrowse,type=cloud-storage,bucket=BUCKET_NAME,readonly=true \
  --add-volume-mount=volume=jbrowse,mount-path=/mnt/jbrowse \
  --allow-unauthenticated
```

`--allow-unauthenticated` lets the request reach the service, which does the
checking. Firebase Hosting can sit in front with a rewrite of `**` to this
service, which is why the cookie is named `__session`. Before serving real data,
add the CSRF check from Firebase's
[session cookie guide](https://firebase.google.com/docs/auth/admin/manage-cookies)
to `/sessionLogin`.

## Other hosts

Any login the browser attaches to every request on the site works by the same
rule, such as
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/)
in front of a site on Cloudflare, or the password protection Netlify and Vercel
offer for a deployed site. Protect the whole site, `data/` included.

## Different tracks for different groups

Give each group a folder holding its own `config.json` and data, behind its own
access rule, and send its members to `?config=groupA/config.json`. In the Basic
auth recipe, that is one `location` per group with its own password file:

```nginx
location /groupA/ {
  auth_basic_user_file /etc/nginx/groupA.htpasswd;
}
```

OAuth2 Proxy (`--allowed-group`), a Lambda@Edge function reading the
`cognito:groups` claim, and the `allowed` check in the Firebase service can make
the same split by path.

## Checking the login covers the data

Request a data file from a browser that is not signed in, or with `curl`:

```bash
curl -s -o /dev/null -D - -H 'Range: bytes=0-100' https://jbrowse.mylab.org/data/sample.bam
```

A `401`, a `403`, a redirect, or a `200` with `content-type: text/html` (the
sign-in page itself) means the file is protected. A `206 Partial Content` means
anyone can read it. Signed in (with `-u alice` for Basic auth, or the session
cookie copied from the browser into `-H 'Cookie: ...'`), the same request
returns `206`.

## When a login expires during a session

A data request arriving after the login expired gets the sign-in page's HTML
back instead of the file's bytes. JBrowse reports that as an error on the track,
often `HTTP 200 ... (should be 206 for range requests)` or a parse error. A
reload sends the user through the sign-in again, and a longer session lifetime
makes it rarer.

## Signing in through your own web app

A web app that already has users (a Next.js or Astro site with Firebase
Authentication, Auth0, Clerk or Cognito through Amplify) can show JBrowse as an
[embedded component](/docs/embedded_components) on a page it renders only after
sign-in. The app's own login then covers JBrowse in one of two ways:

- **Serve the data from the app's own site**, behind the same session check as
  its other routes. The component's requests carry the app's session cookie like
  any other request from the page. A route that streams a data file has to pass
  the `Range` header through and answer `206 Partial Content`.
- **Hand the component signed URLs.** After sign-in, the app asks its backend
  for presigned URLs and builds the track config from them, as
  [Private files in S3](/docs/config_guides/authentication#private-files-in-s3)
  describes. Mint them on each page load, never into a saved session.

Since the app builds the config, it can also give each user only the tracks they
may open, with the data host still enforcing the same rule.

## A sign-in button inside JBrowse Web

A plugin can add a **Sign in** item to a menu with
[`appendToMenu`](/docs/developer_guides/menus) and run a sign-in SDK such as
Firebase Authentication's. The sign-in itself protects nothing, since the files
it should guard are still served to anyone who asks. For data, the plugin also
needs an internet account that attaches the user's token to each request, and
the data host has to check it, as in
[An internet account that signs at fetch time](/docs/config_guides/authentication#an-internet-account-that-signs-at-fetch-time).
The recipes above are less code for that. A plugin sign-in fits per-user
features over public data, such as saving sessions to the user's account.

## When the data lives somewhere else

When the data stays on another host than the app, such as a bucket or a
collaborator's server, the browser has no site cookie to send, and the app has
to present a credential itself. [](/docs/config_guides/authentication) covers
that route: `internetAccounts` for OAuth, HTTP Basic and token logins, and
presigned URLs for private S3 objects.

## See also

- [](/docs/config_guides/deploying)
- [](/docs/config_guides/serving_data)
- [](/docs/config_guides/authentication)
