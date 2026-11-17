---
title: Putting JBrowse Web behind a login
description:
  How to password-protect JBrowse Web and its data, and which login method to
  pick
guide_category: Deployment
---

JBrowse Web is a folder of static files that reads your data files over HTTP, so
the web server decides who sees a dataset. To keep one private, serve the app,
`config.json` and the data from one site, and put that whole site behind a
login. Once the user signs in, the browser attaches the login (a session cookie
or HTTP Basic credentials) to every request on that site by itself, including
the range requests JBrowse's workers make for BAM, CRAM and other indexed files,
so `config.json` stays an ordinary config with the data's plain URLs in it.

## Pick a method

| Method                                       | Suits                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------- |
| [](/docs/config_guides/login_basic_auth)     | a few people, a server you run, a password per person                 |
| [](/docs/config_guides/login_single_sign_on) | an institutional login, Duo, Google or GitHub accounts, an allow-list |
| [](/docs/config_guides/login_aws_cognito)    | files in S3 or on AWS, accounts you create for particular people      |
| [](/docs/config_guides/login_google_cloud)   | files in Cloud Storage, Google accounts or Firebase Authentication    |

Any other login the browser attaches to every request on the site works by the
same rule, such as
[Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/applications/)
or the password protection Netlify and Vercel offer.

## Rules that apply to every method

- **Protect the data folder too.** The browser downloads `config.json`, so every
  file URL in it is visible to anyone who can open the app; a login in front of
  the app alone protects nothing.
- **Leaving a track out of `config.json` protects nothing**, for the same
  reason. Give a group that should see different tracks its own folder holding
  its own `config.json` and data, behind its own access rule, and send its
  members to `?config=groupA/config.json`.
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

The method guides assume the folder `npx @jbrowse/cli create` makes, with the
data files in a `data/` folder beside `config.json` and the tracks pointing at
them by relative URL (`data/sample.bam`).

## Checking the login covers the data

Request a data file from a browser that is not signed in, or with `curl`:

```bash
curl -s -o /dev/null -D - -H 'Range: bytes=0-100' https://jbrowse.mylab.org/data/sample.bam
```

A `401`, a `403`, a redirect, or a `200` with `content-type: text/html` (the
sign-in page itself) means the file is protected. A `206 Partial Content` means
anyone can read it.

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
The method guides are less code for that. A plugin sign-in fits per-user
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
