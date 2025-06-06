---
id: oauthinternetaccount
title: OAuthInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/OAuthInternetAccount.md)

## Docs

### OAuthInternetAccount - Slots

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

### OAuthInternetAccount - Derives from

```js
baseConfiguration: BaseInternetAccountConfig
```
