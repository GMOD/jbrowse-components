---
title: Authentication
description:
  Configuring internetAccounts so JBrowse can read data files that require
  credentials
guide_category: Core configuration
---

**TL;DR:** JBrowse fetches data files directly, so a file behind authentication
needs JBrowse to present the credentials. Add an entry to the top-level
`internetAccounts` array with the `domains` its token applies to: a hostname, or
a URL prefix to scope it to part of a server. The first account whose `domains`
matches a URL wins, so order specific ones first. If you control the server
holding the data, read the next section before configuring any of this.

## Serving JBrowse and its data behind one login

JBrowse has no server and no user accounts of its own. It is static files
running in a browser, reading your data files over HTTP, so whatever serves the
files decides who sees a track. Two consequences:

- **Leaving a track out of config.json protects nothing.** The browser downloads
  config.json, so every URL in it is visible to anyone who can open the app.
- **Never put a password, token, or API key in config.json**, for the same
  reason.

The simpler setup puts JBrowse and its data files on the same server, in the
same site, behind the login the site already has (a session cookie, an SSO
proxy, nginx `auth_request`). The browser then sends the cookie with every data
request by itself: no `internetAccounts` entry, and no credential material in
your config or in a shared session.

### What counts as the same origin

Browsers only send cookies to the origin that set them, so the app and the data
have to share `https://host` and port:

| App at                        | Data at                    | Cookie sent          |
| ----------------------------- | -------------------------- | -------------------- |
| `https://mysite.org/jbrowse/` | `https://mysite.org/data/` | yes                  |
| `https://mysite.org/jbrowse/` | `https://data.mysite.org/` | no, different origin |
| `https://mysite.org/jbrowse/` | an S3 or other bucket URL  | no, different origin |

Protect both, not just the app: a login page in front of JBrowse while the data
folder stays world-readable protects nothing, since the file URLs are in
config.json.

### The login-page failure mode

A data request arriving without a valid login usually gets the HTML of a login
page back. JBrowse asked for bytes of a BAM file, so what it reports is a parse
error, often `HTTP 200 ... (should be 206 for range requests)`. Check a file
directly:

```bash
curl -s -o /dev/null -D - -H 'Range: bytes=0-100' https://mysite.org/data/file.bam
```

A logged-in request answers `206 Partial Content`; a `200` with
`content-type: text/html`, or a redirect, is the login page. A session expiring
while a view is open produces the same errors mid-use, which a reload resolves.

### Alternatives to a shared login

In rough order of simplicity:

- **No server at all.** [JBrowse Desktop](/docs/quickstart_desktop) reads files
  off your own machine, so nothing is published.
- **Expiring links.** [S3 presigned URLs](#private-files-in-s3) or CloudFront
  signed cookies are simple to set up, but a link stops working when its
  signature expires, taking any saved session or share link with it.
- **`internetAccounts`** (the rest of this page), for data you do not control:
  Dropbox, Google Drive, an OAuth-protected API, a portal that issues tokens.
  JBrowse only forwards a credential the user already has; it is not an
  access-control system.

Data on a different origin than the app also needs
[CORS](/docs/config_guides/serving_data#cors-errors-on-remote-files), including
the auth header in `Access-Control-Allow-Headers`.

## Internet accounts

An internet account is an entry in the top-level `internetAccounts` array that
knows how to obtain a token and which URLs to attach it to. With this one in
place, opening a track served from `data.mylab.org` prompts for a username and
password once, then reuses them for the session; nothing on the track config
changes:

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

| Type                                             | Use for                                                    |
| ------------------------------------------------ | ---------------------------------------------------------- |
| [](/docs/config/httpbasicinternetaccount)        | A server behind HTTP Basic auth (username + password)      |
| [](/docs/config/oauthinternetaccount)            | Any OAuth 2.0 provider, configured with your own endpoints |
| [](/docs/config/dropboxoauthinternetaccount)     | Dropbox, with the endpoints pre-filled                     |
| [](/docs/config/googledriveoauthinternetaccount) | Google Drive, with the endpoints pre-filled                |
| [](/docs/config/externaltokeninternetaccount)    | A token the user pastes in, or that your portal hands over |

Every type shares the [BaseInternetAccount](/docs/config/baseinternetaccount)
slots: `internetAccountId`, `name`, `description`, `domains`, and the
`authHeader`/`tokenType` pair naming the request header the token goes in. HTTP
Basic adds
[`validateWithHEAD`](/docs/config/httpbasicinternetaccount/#slot-validatewithhead),
a HEAD request that checks the credentials before using them.

## How an account is matched to a URL

JBrowse picks an account for a file in two steps.

**First, the location's own `internetAccountId`.** A file location can name its
account outright, beside `uri`, which picks that account ahead of the `domains`
walk below. This is also what the Add Track form's account picker writes:

```json addtrack
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

- **The named account still has to be scoped for the URL.** Naming chooses
  between accounts; it does not widen the one it names. A location naming an
  account whose `domains` do not cover its host is read unauthenticated, and
  JBrowse logs which account and which URL to the console.
- **Same-origin files are the exception.** A config written with relative paths
  (`"uri": "data/x.bam"`) resolves against wherever the app is deployed, so
  there is no host to write in `domains`, and an account named on such a
  location is used whatever its `domains` say. A link cannot move a same-origin
  file anywhere but the server already serving the page.
- **An id the config does not declare** is honoured only when its leading
  segment is an account type (`HTTPBasicInternetAccount-myserver`, the form
  JBrowse mints when a server answers 401). Any other unknown id is ignored and
  the file is read unauthenticated, which surfaces as the server's 401.

**Otherwise, the `domains` walk.** JBrowse goes through `internetAccounts` in
order and picks the **first** whose `domains` matches, so put the most specific
accounts first. An entry is one of two shapes, told apart by whether it contains
a `/`:

- **A hostname**, `data.mylab.org` or `localhost:8080` to pin a port, matches
  that host and its subdomains on a dot boundary: `dropbox.com` covers
  `www.dropbox.com` but not `evil-dropbox.com`. A leading dot (`.mylab.org`)
  means the same thing.
- **A URL prefix**, `data.mylab.org/reads` or `https://data.mylab.org/reads/`,
  matches to a path-segment boundary, so `/reads` does not match `/readsets`.
  This scopes an account to a path, so one server can use different credentials
  for different directories:

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

The query string and the fragment are never consulted under either shape, so a
URL that merely mentions one of your domains in a parameter does not match. An
account with an empty `domains` list matches nothing on its own; it still works
for same-origin files a location names it on, and needs the hosts it serves for
anything else, including an account the user picks by hand in the Add Track
form.

:::note Changed in v5

`domains` used to be a plain substring test against the whole URL. Entries that
name a host or a path behave the same way now. Two kinds no longer match: a
fragment of a hostname (`domains: ["dropbox"]` no longer matches `dropbox.com`;
write the whole host), and anything relying on the match landing in a query
string. A location's `internetAccountId` also no longer overrides `domains`; it
orders the choice among accounts already scoped for the URL. Both changes close
the same hole: jbrowse-web builds tracks from `sessionTracks` in the URL, so a
crafted link could otherwise aim a user's token at a server of its choosing. An
account that authenticated an off-origin file through the id alone needs that
file's host added to its `domains`.

:::

## OAuth

Dropbox and Google Drive have their endpoints built in and need only a
`clientId` registered with the provider. Any other provider uses the generic
`OAuthInternetAccount` with its endpoints supplied:

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
      "type": "OAuthInternetAccount",
      "internetAccountId": "myOAuth",
      "name": "Institutional login",
      "domains": ["data.myinstitution.org"],
      "clientId": "your-client-id",
      "authEndpoint": "https://auth.myinstitution.org/oauth/authorize",
      "tokenEndpoint": "https://auth.myinstitution.org/oauth/token",
      "needsPKCE": true
    }
  ]
}
```

JBrowse is a static app with nowhere to keep a client secret, so use the
authorization-code flow with
[`needsPKCE`](/docs/config/oauthinternetaccount/#slot-needspkce), the flow
designed for public clients, and register your JBrowse instance's URL as a
redirect URI with the provider.
[OAuthInternetAccount](/docs/config/oauthinternetaccount) lists `scopes`,
`responseType` and the rest.

## External token

When a portal already holds a token, or the user can paste one in,
[`ExternalTokenInternetAccount`](/docs/config/externaltokeninternetaccount) asks
for the token and runs no auth flow. `authHeader` names the request header it
goes in, which also covers plain API-key headers:

```json
{
  "type": "ExternalTokenInternetAccount",
  "internetAccountId": "externalToken",
  "name": "Access token",
  "domains": ["data.mylab.org"],
  "authHeader": "X-Api-Key"
}
```

## Where tokens are stored

A token obtained during a session lives in the browser's `sessionStorage`, keyed
by `internetAccountId`, and is never written into a saved or shared session:
sharing a session shares the view, and the recipient is prompted for their own
credentials. Closing the tab discards the token.

## Private files in S3

An object in a private bucket has no credential JBrowse can send in a header, so
none of the account types above reach it.

### Presigned URLs

`aws s3 presign` turns a private object into a URL carrying its own signature,
which needs no `internetAccounts` entry. Sign the data file and its index
separately, since each is its own object:

```bash
aws s3 presign s3://mybucket/sample.bam --expires-in 604800
aws s3 presign s3://mybucket/sample.bam.bai --expires-in 604800
```

Both signed URLs go in the track, spelled out; the
[`uri` shorthand](/docs/config_guides/file_types#the-uri-shorthand) cannot carry
them:

```json addtrack
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

Range requests work, because `Range` is not a header a presigned URL signs.
Three things to know:

- **Name the index yourself.** The `uri` shorthand appends `.bai` after the
  signature parameters, which the bucket rejects.
- **Choose the file type yourself.** A signed URL ends in signature parameters,
  not `.bam`, so the Add track form guesses nothing; pick the type in the form
  or write the adapter `type` as above.
- **The link expires.** Seven days is the maximum, and a URL signed with
  temporary credentials expires with the session that signed it. Any saved
  session or share link holding one stops working then.

### An internet account that signs at fetch time

Access that lasts keeps the permanent unsigned URL in the config and derives the
signature per request, which is an internet account in a plugin, since no
built-in type covers S3. A state model extending `BaseInternetAccountModel`
overrides `getFetcher` and either computes a SigV4 signature in the browser over
the URL, method and `range` header, or asks your own backend to presign the URL
and fetches what comes back. Three rules either way:

- **Only a temporary credential reaches the browser** (a Cognito identity pool,
  `AssumeRoleWithWebIdentity`, or your app's own session token that authorizes
  the presign call): config.json is public and a static app has nowhere to keep
  a long-lived key. `validateToken` renews it before it lapses.
- **Swap the URL inside the fetcher, never in the location.** The range cache
  keys on the URL the filehandle was constructed with, so a stable unsigned URL
  keeps it intact; `GoogleDriveOAuthModel` is the in-tree precedent. Cache
  presigned URLs per object with their expiry, so no chunk fetch signs on its
  own.
- **Treat a `403` as a possibly-stale signature** and retry once after
  refreshing, since a credential can lapse between two chunk fetches.

The credential travels to the RPC workers over the existing pre-authorization
path as an opaque token, so neither shape needs extra plumbing. Bucket CORS has
to allow the headers the signature covers (`Authorization`, `Range`,
`x-amz-date`, `x-amz-content-sha256`); see [](/docs/config_guides/serving_data).

CloudFront signed cookies need no JBrowse code, since your app renews the cookie
and the browser attaches it, but only for data on the same origin as the app:
JBrowse's data requests do not opt into sending credentials cross-origin.

An [embedded component](/docs/embedded_components) can skip both routes: the
host app asks its own backend for a signed URL pair and builds the track config
from the result. Mint the URLs on each page load, never into a saved session,
and sign them for longer than a viewing session lasts, since a URL resolved
before the component mounts cannot renew itself.

## CORS

Authenticated requests are still cross-origin requests, so the data server must
allow the `Authorization` header (or whatever `authHeader` names) in
`Access-Control-Allow-Headers`, and must allow credentials; a wildcard origin
does not. See [](/docs/config_guides/serving_data).

## See also

- [](/docs/config_guides/intro)
- [BaseInternetAccount config docs](/docs/config/baseinternetaccount)
- [Configuring tracks](/docs/config_guides/tracks)
