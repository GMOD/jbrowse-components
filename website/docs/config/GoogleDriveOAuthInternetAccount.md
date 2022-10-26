---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Understanding the configuration
model](/docs/devguide_config/) and [Config guide](/docs/config_guide) for more
info

### GoogleDriveOAuthInternetAccount - Slots

#### slot: authEndpoint

```js
authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https:
    }
```

#### slot: scopes

```js
scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: 'https:
    }
```

#### slot: domains

```js
domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: ['drive.google.com"'],
    }
```

#### slot: responseType

```js
responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'token',
    }
```

## GoogleDriveOAuthInternetAccount - Derives from

```js
baseConfiguration: OAuthConfigSchema
```
