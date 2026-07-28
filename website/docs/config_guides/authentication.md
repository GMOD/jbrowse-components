---
title: Authentication
description:
  Configuring internetAccounts so JBrowse can read data files that require
  credentials
guide_category: Core configuration
---

**TL;DR:** JBrowse fetches data files directly, so a file behind authentication
needs JBrowse to present the credentials. Add an entry to the top-level
`internetAccounts` array with the `domains` its token applies to. The first
account whose `domains` substring-matches a URL wins, so order specific ones
first. If you control the server holding the data, read the next section before
configuring any of this.

## If you control the data server, you probably do not need this

JBrowse has no server and no user accounts of its own. It is static files
running in a browser, reading your data files over HTTP, so it cannot decide who
is allowed to see a track. Whatever serves the files has to do that. Two
consequences that catch people out:

- Leaving a track out of config.json does not protect it. The browser downloads
  config.json, so every URL in it is visible to anyone who can open the app.
- Never put a password, token, or API key in config.json, for the same reason.

The simpler setup is to put JBrowse and its data files on the same server, in
the same site, and protect both with the login your site already has (a session
cookie, an SSO proxy, nginx `auth_request`). The browser then sends the cookie
with every data request by itself: no `internetAccounts` entry, and no
credential material in your config or in a shared session.

### What "same origin" means here

The app and the data have to be on the same **origin**: the same `https://host`
and port. Browsers only send cookies to the origin that set them.

| App at                        | Data at                    | Cookie sent          |
| ----------------------------- | -------------------------- | -------------------- |
| `https://mysite.org/jbrowse/` | `https://mysite.org/data/` | yes                  |
| `https://mysite.org/jbrowse/` | `https://data.mysite.org/` | no, different origin |
| `https://mysite.org/jbrowse/` | an S3 or other bucket URL  | no, different origin |

Protect both, not just the app. A login page in front of JBrowse while the data
folder stays world-readable protects nothing, since the file URLs are in
config.json.

### The login-page failure mode

When a data request arrives without a valid login, most auth setups answer with
the HTML of a login page. JBrowse asked for bytes of a BAM file, so instead of a
message about logging in you get a parse error, often
`HTTP 200 ... (should be 206 for range requests)`. Check a file directly:

```bash
curl -s -o /dev/null -D - -H 'Range: bytes=0-100' https://mysite.org/data/file.bam
```

A logged-in request should answer `206 Partial Content`. A `200` with
`content-type: text/html`, or a redirect, is the login page. A session expiring
while a view is open produces the same errors mid-use, which a reload resolves.

### If the cookie setup does not fit

In rough order of simplicity:

- No server at all. [JBrowse Desktop](/docs/quickstart_desktop) reads files off
  your own machine, so nothing is published in the first place.
- Expiring links. S3 presigned URLs or CloudFront signed cookies are simple to
  set up, but a link stops working when its signature expires, taking any saved
  session or share link with it.
- `internetAccounts` (the rest of this page), for data you do not control:
  Dropbox, Google Drive, an OAuth-protected API, a portal that issues tokens.
  JBrowse prompts for the credential and attaches it to requests for the domains
  you list. It only forwards a credential the user already has, it is not an
  access-control system, and it is more moving parts than a cookie in front of a
  folder, so it is worth exhausting the options above first.

Any setup where the data is on a different origin than the app also needs
[CORS](/docs/faq#why-do-i-get-a-cors-error-when-loading-remote-files), including
the auth header in `Access-Control-Allow-Headers`.

## Internet accounts

JBrowse reads data files directly over HTTP, so a file behind authentication
needs JBrowse itself to present the credentials. An **internet account** is an
entry in the top-level `internetAccounts` array that knows how to obtain a token
and which URLs to attach it to.

```json
{
  "internetAccounts": [
    {
      "type": "HTTPBasicInternetAccount",
      "internetAccountId": "myLab",
      "name": "My lab server",
      "domains": ["data.mylab.org"]
    }
  ]
}
```

With that in place, opening a track whose URL contains `data.mylab.org` prompts
the user for credentials once, then reuses them for the rest of the session.
Nothing on the track config changes.

## Account types

| Type                                             | Use for                                                    |
| ------------------------------------------------ | ---------------------------------------------------------- |
| [](/docs/config/httpbasicinternetaccount)        | A server behind HTTP Basic auth (username + password)      |
| [](/docs/config/oauthinternetaccount)            | Any OAuth 2.0 provider, configured with your own endpoints |
| [](/docs/config/dropboxoauthinternetaccount)     | Dropbox, with the endpoints pre-filled                     |
| [](/docs/config/googledriveoauthinternetaccount) | Google Drive, with the endpoints pre-filled                |
| [](/docs/config/externaltokeninternetaccount)    | A token the user pastes in, or that your portal hands over |

Every type shares the slots on [](/docs/config/baseinternetaccount):
`internetAccountId` (the unique id), `name` and `description` (shown in the UI),
`domains` (below), and `authHeader`/`tokenType`, which control the request
header the token is sent in.

## How an account is matched to a URL

When JBrowse fetches a file, it walks `internetAccounts` in order and picks the
**first** account whose `domains` matches. The match is a plain substring test
against the whole URL, not a hostname comparison, which has two consequences:

- You can scope an account to a **path**, not just a host, by including the path
  in the domain entry. This is how one server can use different credentials for
  different directories:

  ```json
  {
    "internetAccounts": [
      {
        "type": "HTTPBasicInternetAccount",
        "internetAccountId": "publicData",
        "name": "Public data",
        "domains": ["data.mylab.org/public"]
      },
      {
        "type": "HTTPBasicInternetAccount",
        "internetAccountId": "privateData",
        "name": "Private data",
        "domains": ["data.mylab.org/private"]
      }
    ]
  }
  ```

- Because it is a substring test, a short entry matches more than you might
  expect. Order matters: put the most specific accounts first, since the first
  match wins.

An account with an empty `domains` list never matches automatically. It is still
usable, because the user can select it explicitly when opening a file through
the Add Track form.

## HTTP Basic

```json
{
  "type": "HTTPBasicInternetAccount",
  "internetAccountId": "myLab",
  "name": "My lab server",
  "domains": ["data.mylab.org"]
}
```

The user is prompted for a username and password, which are encoded into the
auth header. See the
[HTTPBasicInternetAccount config docs](/docs/config/httpbasicinternetaccount)
for its slots, including
[`validateWithHEAD`](/docs/config/httpbasicinternetaccount/#slot-validatewithhead),
which sends a HEAD request to check the credentials before using them.

## OAuth

Dropbox and Google Drive have their endpoints built in, so they need only a
`clientId` registered with the provider:

```json
{
  "internetAccounts": [
    {
      "type": "DropboxOAuthInternetAccount",
      "internetAccountId": "dropboxOAuth",
      "name": "Dropbox",
      "clientId": "your-dropbox-client-id"
    },
    {
      "type": "GoogleDriveOAuthInternetAccount",
      "internetAccountId": "googleOAuth",
      "name": "Google Drive",
      "clientId": "your-google-client-id"
    }
  ]
}
```

For any other provider, use the generic `OAuthInternetAccount` and supply the
endpoints yourself:

```json
{
  "type": "OAuthInternetAccount",
  "internetAccountId": "myOAuth",
  "name": "Institutional login",
  "domains": ["data.myinstitution.org"],
  "clientId": "your-client-id",
  "authEndpoint": "https://auth.myinstitution.org/oauth/authorize",
  "tokenEndpoint": "https://auth.myinstitution.org/oauth/token",
  "needsPKCE": true
}
```

JBrowse is a static app with no server side, so there is nowhere to keep a
client secret. Use the authorization-code flow with
[`needsPKCE`](/docs/config/oauthinternetaccount/#slot-needspkce) enabled, which
is the flow designed for public clients. Register your JBrowse instance's URL as
a redirect URI with the provider. See the
[OAuthInternetAccount config docs](/docs/config/oauthinternetaccount) for
[`scopes`](/docs/config/oauthinternetaccount/#slot-scopes),
[`responseType`](/docs/config/oauthinternetaccount/#slot-responsetype), and the
rest of the slots.

## External token

When a portal already holds a token, or the user can paste one in, use
`ExternalTokenInternetAccount`. JBrowse asks for the token rather than running
an auth flow:

```json
{
  "type": "ExternalTokenInternetAccount",
  "internetAccountId": "externalToken",
  "name": "Access token",
  "domains": ["data.mylab.org"],
  "authHeader": "X-Api-Key"
}
```

`authHeader` is the request header the token is placed in, so this also covers
plain API-key headers. See the
[ExternalTokenInternetAccount config docs](/docs/config/externaltokeninternetaccount).

## Where tokens are stored

A token obtained during a session is kept in the browser's `sessionStorage`,
keyed by the account's `internetAccountId`. It is not written into a saved or
shared session, so sharing a session with a colleague shares the view, not your
credentials. They are prompted for their own. Closing the tab discards the
token.

## CORS

Authenticated requests are still cross-origin requests, so the data server must
send the CORS headers that allow them, including the `Authorization` header (or
whatever `authHeader` names) in `Access-Control-Allow-Headers`, and it must
allow credentials rather than responding with a wildcard origin. See
[the CORS FAQ](/docs/faq#why-do-i-get-a-cors-error-when-loading-remote-files).

This is another reason the same-origin cookie setup above is easier where it is
available: there is no cross-origin request to configure.

## See also

- [](/docs/config_guides/intro)
- [BaseInternetAccount config docs](/docs/config/baseinternetaccount)
- [Configuring tracks](/docs/config_guides/tracks)
- [FAQ: how do I put my data behind a login](/docs/faq#how-do-i-put-my-data-behind-a-login)
