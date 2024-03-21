---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/authentication/src/DropboxOAuthModel/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/configSchema.ts)

### DropboxOAuthInternetAccount - Slots

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
      defaultValue: [
        'addtodropbox.com',
        'db.tt',
        'dropbox.com',
        'dropboxapi.com',
        'dropboxbusiness.com',
        'dropbox.tech',
        'getdropbox.com',
      ],
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
    }
```

#### slot: needsPKCE

```js
needsPKCE: {
      defaultValue: true,
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
    }
```

#### slot: tokenEndpoint

```js
tokenEndpoint: {
      defaultValue: 'https:
      description: 'the token endpoint of the internet account',
      type: 'string',
    }
```

### DropboxOAuthInternetAccount - Derives from

```js
baseConfiguration: OAuthConfigSchema
```
