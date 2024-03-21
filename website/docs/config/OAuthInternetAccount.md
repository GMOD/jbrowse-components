---
id: oauthinternetaccount
title: OAuthInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/authentication/src/OAuthModel/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/OAuthModel/configSchema.ts)

### OAuthInternetAccount - Slots

#### slot: authEndpoint

```js
authEndpoint: {
      defaultValue: '',
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
    }
```

#### slot: clientId

```js
clientId: {
      defaultValue: '',
      description: 'id for the OAuth application',
      type: 'string',
    }
```

#### slot: needsPKCE

```js
needsPKCE: {
      defaultValue: false,
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
    }
```

#### slot: responseType

```js
responseType: {
      defaultValue: 'code',
      description:
        "the type of response from the authorization endpoint. can be 'token' or 'code'",
      type: 'string',
    }
```

#### slot: scopes

```js
scopes: {
      defaultValue: '',
      description: 'optional scopes for the authorization call',
      type: 'string',
    }
```

#### slot: state

```js
state: {
      defaultValue: '',
      description: 'optional state for the authorization call',
      type: 'string',
    }
```

#### slot: tokenEndpoint

```js
tokenEndpoint: {
      defaultValue: '',
      description: 'the token endpoint of the internet account',
      type: 'string',
    }
```

#### slot: tokenType

```js
tokenType: {
      defaultValue: 'Bearer',
      description: 'a custom name for a token to include in the header',
      type: 'string',
    }
```

### OAuthInternetAccount - Derives from

```js
baseConfiguration: BaseInternetAccountConfig
```
