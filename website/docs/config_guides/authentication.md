---
title: Authentication
description:
  Configuring internetAccounts so JBrowse can read data files that require
  credentials
guide_category: Core configuration
---

JBrowse reads data files directly over HTTP, so a file behind authentication
needs JBrowse itself to present the credentials. That is what an **internet
account** does: it is an entry in the top-level `internetAccounts` array that
knows how to obtain a token and which URLs to attach it to.

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

| Type                                                                            | Use for                                                    |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [HTTPBasicInternetAccount](/docs/config/httpbasicinternetaccount)               | A server behind HTTP Basic auth (username + password)      |
| [OAuthInternetAccount](/docs/config/oauthinternetaccount)                       | Any OAuth 2.0 provider, configured with your own endpoints |
| [DropboxOAuthInternetAccount](/docs/config/dropboxoauthinternetaccount)         | Dropbox, with the endpoints pre-filled                     |
| [GoogleDriveOAuthInternetAccount](/docs/config/googledriveoauthinternetaccount) | Google Drive, with the endpoints pre-filled                |
| [ExternalTokenInternetAccount](/docs/config/externaltokeninternetaccount)       | A token the user pastes in, or that your portal hands over |

Every type shares the slots on
[BaseInternetAccount](/docs/config/baseinternetaccount): `internetAccountId`
(the unique id), `name` and `description` (shown in the UI), `domains` (below),
and `authHeader`/`tokenType`, which control the request header the token is sent
in.

## How an account is matched to a URL

When JBrowse needs to fetch a file, it walks `internetAccounts` in order and
picks the **first** account whose `domains` matches. The match is a plain
substring test against the whole URL, not a hostname comparison. That has two
consequences worth knowing:

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
[the CORS FAQ](/docs/faq/#why-do-i-get-a-cors-error-when-loading-remote-files).

## See also

- [config.json format](/docs/config_guides/intro)
- [BaseInternetAccount config docs](/docs/config/baseinternetaccount)
- [Configuring tracks](/docs/config_guides/tracks)
