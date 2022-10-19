---
id: dropboxoauthconfigschema
title: DropboxOAuthConfigSchema
toplevel: true
---

#### slot: authEndpoint
```js

    /**
     * !slot
     */
    authEndpoint: {
      description: 'the authorization code endpoint of the internet account',
      type: 'string',
      defaultValue: 'https://www.dropbox.com/oauth2/authorize',
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
      defaultValue: 'https://api.dropbox.com/oauth2/token',
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
      defaultValue: true,
    }
```
#### slot: domains
```js

    /**
     * !slot
     */
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
#### slot: hasRefreshToken
```js

    /**
     * !slot
     */
    hasRefreshToken: {
      description: 'true if the endpoint can supply a refresh token',
      type: 'boolean',
      defaultValue: true,
    }
```
#### derives from: 
```js

    /**
     * !baseConfiguration
     */
    baseConfiguration: OAuthConfigSchema
```
