---
id: googledriveoauthconfigschema
title: GoogleDriveOAuthConfigSchema
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
      defaultValue: 'https://accounts.google.com/o/oauth2/v2/auth',
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
      defaultValue: 'https://www.googleapis.com/auth/drive.readonly',
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
      defaultValue: ['drive.google.com"'],
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
      defaultValue: 'token',
    }
```
#### derives from: 
```js

    /**
     * !baseConfiguration
     */
    baseConfiguration: OAuthConfigSchema
```
