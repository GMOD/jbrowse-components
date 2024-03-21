---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/authentication/src/GoogleDriveOAuthModel/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/GoogleDriveOAuthModel/configSchema.ts)

### GoogleDriveOAuthInternetAccount - Slots

#### slot: authEndpoint

```js
authEndpoint: {
      defaultValue: 'https:
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
    }
```

#### slot: domains

```js
domains: {
      defaultValue: ['drive.google.com"'],
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
    }
```

#### slot: responseType

```js
responseType: {
      defaultValue: 'token',
      description: 'the type of response from the authorization endpoint',
      type: 'string',
    }
```

#### slot: scopes

```js
scopes: {
      defaultValue: 'https:
      description: 'optional scopes for the authorization call',
      type: 'string',
    }
```

### GoogleDriveOAuthInternetAccount - Derives from

```js
baseConfiguration: OAuthConfigSchema
```
