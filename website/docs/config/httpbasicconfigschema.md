---
id: httpbasicconfigschema
title: HTTPBasicConfigSchema
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
      defaultValue: 'Basic',
    }
```
#### slot: validateWithHEAD
```js

    /**
     * !slot
     */
    validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    }
```
#### derives from: 
```js

    /**
     * !baseConfiguration
     */
    baseConfiguration: BaseInternetAccountConfig
```
