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
      defaultValue: 'https://www.dropbox.com/oauth2/authorize',
    }
```

#### slot: tokenEndpoint

```js
tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://api.dropbox.com/oauth2/token',
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

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

### Inherited from [OAuthInternetAccount](../oauthinternetaccount)

#### slot: tokenType

```js
tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Bearer',
    }
```

#### slot: authEndpoint

```js
authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: tokenEndpoint

```js
tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: needsPKCE

```js
needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: false,
    }
```

#### slot: clientId

```js
clientId: {
      description: 'id for the OAuth application',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: scopes

```js
scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: state

```js
state: {
      description: 'optional state for the authorization call',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: responseType

```js
responseType: {
      description:
        "the type of response from the authorization endpoint. can be 'token' or 'code'",
      type: 'string',
      defaultValue: 'code',
    }
```

### Inherited from [BaseInternetAccount](../baseinternetaccount)

#### slot: name

```js
name: {
      description: 'descriptive name of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: description

```js
description: {
      description: 'a description of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: authHeader

```js
authHeader: {
      description: 'request header for credentials',
      type: 'string',
      defaultValue: 'Authorization',
    }
```

#### slot: tokenType

```js
tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: domains

```js
domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [],
    }
```

### DropboxOAuthInternetAccount - Derives from

- [OAuthInternetAccount](../oauthinternetaccount)

```js
baseConfiguration: OAuthConfigSchema
```
