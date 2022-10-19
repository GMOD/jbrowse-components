---
id: oauthconfigschema
title: OAuthConfigSchema
toplevel: true
---

#### slot: tokenType
```js

    /**
     * !slot
     */
    tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Bearer',
    }
```
#### slot: authEndpoint
```js

    /**
     * !slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    }
```
#### slot: tokenEndpoint
```js

    /**
     * !slot
     */
    tokenEndpoint: {
      description: 'the token endpoint of the internet account',
      type: 'string',
      defaultValue: '',
    }
```
#### slot: needsPKCE
```js

    /**
     * !slot
     */
    needsPKCE: {
      description: 'boolean to indicate if the endpoint needs a PKCE code',
      type: 'boolean',
      defaultValue: false,
    }
```
#### slot: clientId
```js

    /**
     * !slot
     */
    clientId: {
      description: 'id for the OAuth application',
      type: 'string',
      defaultValue: '',
    }
```
#### slot: scopes
```js

    /**
     * !slot
     */
    scopes: {
      description: 'optional scopes for the authorization call',
      type: 'string',
      defaultValue: '',
    }
```
#### slot: responseType
```js

    /**
     * !slot
     */
    responseType: {
      description: 'the type of response from the authorization endpoint',
      type: 'string',
      defaultValue: 'code',
    }
```
#### slot: hasRefreshToken
```js

    /**
     * !slot
     */
    hasRefreshToken: {
      description: 'true if the endpoint can supply a refresh token',
      type: 'boolean',
      defaultValue: false,
    }
```
#### derives from: 
```js

    /**
     * !baseConfiguration
     */
    baseConfiguration: BaseInternetAccountConfig
```
