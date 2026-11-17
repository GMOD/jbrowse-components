---
title: Login with Google Cloud (IAP or Firebase)
description:
  Putting JBrowse Web in Cloud Storage behind Identity-Aware Proxy, or behind a
  Firebase Authentication sign-in on Cloud Run
guide_category: Deployment
---

On Google Cloud, JBrowse sits in a private Cloud Storage bucket and a Cloud Run
service serves it. Either Identity-Aware Proxy (IAP) checks the login, letting
in only the Google accounts and groups you name, with no code; or a small
service checks a Firebase Authentication sign-in, for accounts that are not
Google accounts. Firebase Hosting on its own cannot do this, since it serves its
static files to anyone. Put the whole JBrowse folder behind the login, data
included; [](/docs/config_guides/behind_a_login) lists the rules every method
shares.

Both start by uploading the JBrowse folder to a bucket:

```bash
gcloud storage rsync --recursive ./jbrowse gs://BUCKET_NAME
```

## Identity-Aware Proxy

Google's own recipe serves a private bucket through an nginx container on Cloud
Run with IAP in front, which fits JBrowse as it is. Follow
[Enable IAP for Cloud Storage buckets](https://cloud.google.com/iap/docs/enabling-gcs-cloud-run),
which also creates the service account that reads the bucket; its deploy step
mounts the bucket as nginx's web root:

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

Turn on IAP for the service, then let people in one at a time, or a Google group
at once, with the `IAP-secured Web App User` role
(`roles/iap.httpsResourceAccessor`). Each file read is a Cloud Storage call, so
a busy site benefits from the caching options that recipe describes.

## Firebase Authentication

Firebase Authentication signs users in on the page itself, with Google, email
links or the other providers it supports, and leaves the server to check them.
The service below runs on Cloud Run. It turns a Firebase sign-in into a session
cookie for the people on its list, checks the cookie on every request, and
serves the JBrowse folder from the mounted bucket. Install `express@5`,
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

## See also

- [](/docs/config_guides/behind_a_login)
- [](/docs/config_guides/login_single_sign_on)
