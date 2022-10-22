---
id: googledriveoauthconfigschema
title: GoogleDriveOAuthConfigSchema
toplevel: true
---

### Slots

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

## Derives from

```js
baseConfiguration: OAuthConfigSchema
```
