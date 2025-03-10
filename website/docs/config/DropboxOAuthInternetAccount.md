---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/DropboxOAuthInternetAccount.md)

## Docs

### DropboxOAuthInternetAccount - Slots

#### slot: authEndpoint

```js
authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https:
    }
```

#### slot: tokenEndpoint

```js
tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: 'https:
    }
```

#### slot: needsPKCE

```js
needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: true,
    }
```

#### slot: domains

```js
domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [
        'addtodropbox.com',
        'db.tt',
        'dropbox.com',
        'dropboxapi.com',
        'dropboxbusiness.com',
        'dropbox.tech',
        'getdropbox.com',
      ],
    }
```

### DropboxOAuthInternetAccount - Derives from

```js
baseConfiguration: OAuthConfigSchema
```
