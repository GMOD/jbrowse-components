---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
sidebar_label: Internet Account -> DropboxOAuthInternetAccount
---

Auto-generated config schema for the current JBrowse release — see the
[config guide](/docs/config_guide) for concepts. Provided by the
`authentication` plugin.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/configSchema.ts).

## Related links

- **State model:** [runtime API](../../models/dropboxoauthinternetaccount)
- **Base config:** [OAuthInternetAccount](../oauthinternetaccount)

## Config slots

These slots are top-level fields of the account's entry in `internetAccounts`.
Slot types (`fileLocation`, `frozen`, ...) are explained in the
[config slot types reference](/docs/config_guides/slot_types). Slots a base
configuration contributes are listed here too, so this table is the whole
surface.

<!-- prettier-ignore -->
| Slot | Description | From |
| --- | --- | --- |
| <span id="slot-authendpoint">**authEndpoint**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'https://www.dropbox.com/oauth2/authorize'</code> | the authorization code endpoint of the internet account |  |
| <span id="slot-tokenendpoint">**tokenEndpoint**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'https://api.dropbox.com/oauth2/token'</code> | the token endpoint of the internet account |  |
| <span id="slot-needspkce">**needsPKCE**</span><br>[`boolean`](/docs/config_guides/slot_types#boolean) = <code>true</code> | boolean to indicate if the endpoint needs a PKCE code |  |
| <span id="slot-domains">**domains**</span><br>`stringArray` = <code>[]</code> | array of valid domains the url can contain to use this account |  |
| <span id="slot-tokentype">**tokenType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Bearer'</code> | a custom name for a token to include in the header | [OAuthInternetAccount](../oauthinternetaccount) |
| <span id="slot-clientid">**clientId**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | id for the OAuth application | [OAuthInternetAccount](../oauthinternetaccount) |
| <span id="slot-scopes">**scopes**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | optional scopes for the authorization call | [OAuthInternetAccount](../oauthinternetaccount) |
| <span id="slot-state">**state**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | optional state for the authorization call | [OAuthInternetAccount](../oauthinternetaccount) |
| <span id="slot-responsetype">**responseType**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'code'</code> | the type of response from the authorization endpoint. can be 'token' or 'code' | [OAuthInternetAccount](../oauthinternetaccount) |
| <span id="slot-name">**name**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | descriptive name of the internet account | [BaseInternetAccount](../baseinternetaccount) |
| <span id="slot-description">**description**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>''</code> | a description of the internet account | [BaseInternetAccount](../baseinternetaccount) |
| <span id="slot-authheader">**authHeader**</span><br>[`string`](/docs/config_guides/slot_types#string) = <code>'Authorization'</code> | request header for credentials | [BaseInternetAccount](../baseinternetaccount) |
