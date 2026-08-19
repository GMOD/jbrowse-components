---
title: Authentication
description:
  Configuring internetAccounts so JBrowse can read data files that require
  credentials
guide_category: Core configuration
---

**TL;DR:** JBrowse fetches data files directly, so a file behind authentication
needs JBrowse to present the credentials. Add an entry to the top-level
`internetAccounts` array with the `domains` its token applies to — a hostname,
or a URL prefix if you want to scope it to part of a server. The first account
whose `domains` matches a URL wins, so order specific ones first. If you control
the server holding the data, read the next section before configuring any of
this.

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
- Expiring links. [S3 presigned URLs](#private-files-in-s3) or CloudFront signed
  cookies are simple to set up, but a link stops working when its signature
  expires, taking any saved session or share link with it.
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

With that in place, opening a track served from `data.mylab.org` prompts the
user for credentials once, then reuses them for the rest of the session. Nothing
on the track config changes.

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

JBrowse picks an account for a file in two steps.

**First, the location's own `internetAccountId`.** A file location can name its
account outright — `internetAccountId` sits beside `uri` — which picks that
account ahead of the `domains` walk below, so a specific file can use an account
that is not the first one matching its host:

```json
{
  "type": "AlignmentsTrack",
  "trackId": "private_bam",
  "name": "Private alignments",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": {
      "uri": "https://cdn.example.com/x.bam",
      "locationType": "UriLocation",
      "internetAccountId": "myLab"
    },
    "index": {
      "location": {
        "uri": "https://cdn.example.com/x.bam.bai",
        "locationType": "UriLocation",
        "internetAccountId": "myLab"
      }
    }
  }
}
```

**The named account still has to be scoped for the URL.** Naming an account
chooses between accounts; it does not widen the one it names. A location naming
an account whose `domains` do not cover its host is read unauthenticated, and
JBrowse logs which account and which URL to the console. This is also what the
Add Track form's account picker writes, so an account offered there needs the
host in its `domains` for the file to authenticate.

**One exception, for the case `domains` cannot express**: a file served from the
same origin as JBrowse itself. A config written with relative paths
(`"uri": "data/x.bam"`) resolves against wherever the app is deployed, which
whoever wrote the config does not know, so there is no host to write down. An
account named on such a location is used whatever its `domains` say — a link
cannot move a same-origin file anywhere but the server already serving the page.

An id naming an account the config does not declare is only honoured when its
leading segment is an account **type** — `HTTPBasicInternetAccount-myserver`,
the form JBrowse mints for itself when a server answers 401. Any other unknown
id is ignored and the file is read unauthenticated, which surfaces as the 401
the server sends rather than as an error about the account.

**Otherwise, the `domains` walk.** JBrowse goes through `internetAccounts` in
order and picks the **first** whose `domains` matches. An entry is read as one
of two shapes, told apart by whether it contains a `/`:

- **A hostname** — `data.mylab.org`, or `localhost:8080` to pin a port. It
  matches that host and its subdomains, on a dot boundary: `dropbox.com` covers
  `www.dropbox.com` but not `evil-dropbox.com`. A leading dot (`.mylab.org`) is
  accepted and means the same thing.
- **A URL prefix**, if it contains a `/` — `data.mylab.org/reads`, or with a
  scheme, `https://data.mylab.org/reads/`. It matches to a path-segment
  boundary, so `/reads` does not match `/readsets`. This is how you scope an
  account to a **path**, so one server can use different credentials for
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

Order still matters: put the most specific accounts first, since the first match
wins.

The query string and the fragment are never consulted under either shape, so a
URL that merely mentions one of your domains in a parameter does not match it.

:::note Changed in v5

`domains` used to be a plain substring test against the whole URL. Entries that
name a host or a path — which is nearly all of them — behave the same way now.
Two kinds of entry no longer match: a **fragment of a hostname**
(`domains: ["dropbox"]` no longer matches `dropbox.com`; write the whole host),
and anything relying on the match landing in a **query string**.

A location's `internetAccountId` also no longer overrides `domains`; it orders
the choice among accounts already scoped for the URL. Both changes close the
same hole — jbrowse-web builds tracks from `sessionTracks` in the URL, so a
crafted link could otherwise aim a user's token at a server of its choosing. An
account that authenticated an **off-origin** file through the id alone needs
that file's host added to its `domains`; same-origin files are unaffected.

:::

An account with an empty `domains` list matches nothing on its own. It is still
usable for files a location names it on, but only same-origin ones — give it the
hosts it serves for anything else, including an account the user picks by hand
in the Add Track form.

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

## Private files in S3

An object in a private bucket has no credential JBrowse can be told to send in a
header, so none of the account types above reach it. Two approaches do.

### Presigned URLs

`aws s3 presign` turns a private object into a URL that carries its own
signature in the query string. It needs no `internetAccounts` entry and no
plugin, because what JBrowse fetches is an ordinary URL. Sign the data file and
its index separately, since each is its own object:

```bash
aws s3 presign s3://mybucket/sample.bam --expires-in 604800
aws s3 presign s3://mybucket/sample.bam.bai --expires-in 604800
```

Both signed URLs then go in the track, spelled out rather than using the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand):

```json
{
  "type": "AlignmentsTrack",
  "trackId": "private_sample",
  "name": "Sample from a private bucket",
  "assemblyNames": ["hg38"],
  "adapter": {
    "type": "BamAdapter",
    "bamLocation": {
      "uri": "https://mybucket.s3.amazonaws.com/sample.bam?X-Amz-Algorithm=..."
    },
    "index": {
      "location": {
        "uri": "https://mybucket.s3.amazonaws.com/sample.bam.bai?X-Amz-Algorithm=..."
      }
    }
  }
}
```

Range requests work, because `Range` is not one of the headers a presigned URL
signs, so S3 answers them as usual. Three things to know before relying on this:

- **Name the index yourself.** The `uri` shorthand derives a missing index URL
  by appending `.bai`, which on a signed URL lands after the signature
  parameters and produces a URL the bucket rejects.
- **Choose the file type yourself.** Type detection matches the end of the URL,
  and a signed URL ends in signature parameters rather than in `.bam`, so the
  Add track form guesses nothing. Pick the type in the form, or write the
  adapter `type` as above.
- **The link expires.** Seven days is the maximum, and a URL signed with
  temporary credentials expires with the session that signed it, which is much
  sooner. Any saved session or share link holding one stops working at that
  point.

### An internet account that signs at fetch time

A signed URL written into a config expires there, so the way to get access that
lasts is to keep the **permanent unsigned URL** in the config and derive the
signature per request. That is an internet account, and it refreshes on the same
mechanics OAuth uses: `getFetcher` obtains the credential through
`getValidatedToken`, `validateToken` is where an expiring credential is renewed,
and `removeToken` drops the cached one so the next request re-derives it. No
built-in account type covers S3, so this is a plugin. It has two shapes.

**Sign in the browser.** A state model extending `BaseInternetAccountModel`
overrides `getFetcher` and computes a SigV4 signature there, over the URL, the
method, and the `range` header its caller passed in. Each range request is a
different string to sign, so the signature is per request and can never be
obtained once and cached. What is cached is the credential, and it must be a
**temporary** one from a Cognito identity pool or from
`AssumeRoleWithWebIdentity`: a static app has nowhere to keep a long-lived
access key, and config.json is public. `validateToken` checks how much life the
credentials have left and trades them for a fresh set before they lapse.

**Presign on your own backend.** Where you would rather no AWS credential
reached the browser at all, `getFetcher` asks your backend to sign the URL it
was handed, then fetches the URL that comes back with the caller's `init`
untouched. The credential JBrowse holds is your app's own session token, which
is what authorizes the presign call. Signed URLs can be short-lived here, a few
minutes, because nothing persists them. Cache them per object with their expiry
rather than presigning every 256 KB chunk, and swap the URL **inside** the
fetcher rather than rewriting the location: the range cache keys on the URL the
filehandle was constructed with, so a stable unsigned URL keeps the cache intact
while a rotating signed one would fragment it. `GoogleDriveOAuthModel` is the
in-tree precedent for rewriting the URL per request this way.

Either shape works in the RPC workers with no extra plumbing, because the
credential travels there over the existing pre-authorization path as an opaque
token. Both should also treat a `403` as a possibly-stale signature and retry
once after refreshing, since a credential can lapse between two chunk fetches of
a file already open on screen.

Bucket CORS then has to allow the headers the signature covers (`Authorization`,
`Range`, `x-amz-date`, `x-amz-content-sha256`). Exposing `Content-Range` is
worth doing but is not required: reads walk the file by range and detect its end
from a short response, so a track loads either way. See
[the CORS FAQ](/docs/faq#why-do-i-get-a-cors-error-when-loading-remote-files).

CloudFront signed cookies are the one route that needs no JBrowse code and
refreshes without it, since your app renews the cookie and the browser attaches
it. It only applies when the data is served from the same origin as the app,
though, because JBrowse's data requests do not opt into sending credentials
cross-origin.

### Resolving the URL outside JBrowse

An [embedded component](/docs/embedded_components) can skip both routes. The
host app asks whatever backend it already runs for a signed URL pair, then
builds the track config from the result. Access control stays where the app
already enforces it, JBrowse fetches a plain URL, and no credential is involved
on the JBrowse side at all. Mint the URLs each time the page loads rather than
persisting them into a saved session, and sign them for longer than a viewing
session is likely to last: a URL resolved before the component mounts cannot
renew itself afterwards, which is the reason for the fetch-time account above.

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
