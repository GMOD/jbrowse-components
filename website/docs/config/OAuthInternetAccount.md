---
id: oauthinternetaccount
title: OAuthInternetAccount
description: "Signs requests to a resource that uses OAuth 2.0, fetching and refreshing the access token through the provider's authorization flow."
sidebar_label: Internet Account -> OAuthInternetAccount
---

Auto-generated from the config schema in the source. See the [config guide](/docs/config_guide) for concepts. Provided by the `authentication` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/configSchema.ts).

Signs requests to a resource that uses OAuth 2.0, fetching and refreshing
the access token through the provider's authorization flow.

## Example usage

Any OAuth 2.0 provider, with its endpoints supplied. Register the JBrowse
page's URL as a redirect URI with the provider, and use `needsPKCE`, since a
static app has nowhere to keep a client secret.

```js
{
  type: 'OAuthInternetAccount',
  internetAccountId: 'myOAuth',
  name: 'Institutional login',
  domains: ['data.myinstitution.org'],
  clientId: 'your-client-id',
  authEndpoint: 'https://auth.myinstitution.org/oauth/authorize',
  tokenEndpoint: 'https://auth.myinstitution.org/oauth/token',
  needsPKCE: true,
}
```

## Related links

- **Extended by:** [DropboxOAuthInternetAccount](../dropboxoauthinternetaccount)
- **Extended by:** [GoogleDriveOAuthInternetAccount](../googledriveoauthinternetaccount)
- **State model:** [runtime API](../../models/oauthinternetaccount)
- **Base config:** [BaseInternetAccount](../baseinternetaccount)

## Config slots

Account slots are top-level fields of the account's entry in `internetAccounts`. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-tokentype">**tokenType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Bearer'</code> | a custom name for a token to include in the header |
| <span id="slot-authendpoint">**authEndpoint**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the authorization code endpoint of the internet account |
| <span id="slot-tokenendpoint">**tokenEndpoint**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the token endpoint of the internet account |
| <span id="slot-needspkce">**needsPKCE**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | boolean to indicate if the endpoint needs a PKCE code |
| <span id="slot-clientid">**clientId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | id for the OAuth application |
| <span id="slot-scopes">**scopes**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | optional scopes for the authorization call |
| <span id="slot-responsetype">**responseType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'code'</code> | the type of response from the authorization endpoint. can be 'token' or 'code' |
| <span class="slot-group">Inherited from [BaseInternetAccount](../baseinternetaccount)</span> | <span class="slot-group-count">4 slots</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the internet account |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the internet account |
| <span id="slot-authheader">**authHeader**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Authorization'</code> | request header for credentials |
| <span id="slot-domains">**domains**</span><br>[`stringArray`](/docs/config_guides/slot_types#stringarray) = <code>[]</code> | array of valid domains the url can contain to use this account |
