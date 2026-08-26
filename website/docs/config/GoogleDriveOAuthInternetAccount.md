---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
sidebar_label: Internet Account -> GoogleDriveOAuthInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the [config guide](/docs/config_guide) for concepts. Provided by the `authentication` plugin. [View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/GoogleDriveOAuthModel/configSchema.ts).

## Example usage

The Google endpoints and scopes are pre-filled, so an entry needs only your
own OAuth app's `clientId`.
```js
{
  type: 'GoogleDriveOAuthInternetAccount',
  internetAccountId: 'googleDriveOAuth',
  name: 'Google Drive',
  clientId: 'your-client-id.apps.googleusercontent.com',
}
```

_See the **Config slots** section below for all available configuration fields._

## Related links

- **State model:** [runtime API](../../models/googledriveoauthinternetaccount)
- **Base config:** [OAuthInternetAccount](../oauthinternetaccount)

## Config slots

These slots are top-level fields of the account's entry in `internetAccounts`. Slot types (`fileLocation`, `frozen`, ...) are explained in the [config slot types reference](/docs/config_guides/slot_types). Slots a base configuration contributes are listed here too, so this table is the whole surface.

<!-- prettier-ignore -->
| Slot | Description |
| --- | --- |
| <span id="slot-authendpoint">**authEndpoint**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'https://accounts.google.com/o/oauth2/v2/auth'</code> | the authorization code endpoint of the internet account |
| <span id="slot-scopes">**scopes**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'https://www.googleapis.com/auth/drive.readonly'</code> | optional scopes for the authorization call |
| <span id="slot-domains">**domains**</span><br>`stringArray` = <code>['drive.google.com']</code> | array of valid domains the url can contain to use this account |
| <span id="slot-responsetype">**responseType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'token'</code> | the type of response from the authorization endpoint |
| <span class="slot-group">Inherited from [OAuthInternetAccount](../oauthinternetaccount)</span> | <span class="slot-group-count">5 slots</span> |
| <span id="slot-tokentype">**tokenType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Bearer'</code> | a custom name for a token to include in the header |
| <span id="slot-tokenendpoint">**tokenEndpoint**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | the token endpoint of the internet account |
| <span id="slot-needspkce">**needsPKCE**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>false</code> | boolean to indicate if the endpoint needs a PKCE code |
| <span id="slot-clientid">**clientId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | id for the OAuth application |
| <span id="slot-state">**state**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | optional state for the authorization call |
| <span class="slot-group">Inherited from [BaseInternetAccount](../baseinternetaccount)</span> | <span class="slot-group-count">3 slots</span> |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the internet account |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the internet account |
| <span id="slot-authheader">**authHeader**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Authorization'</code> | request header for credentials |
