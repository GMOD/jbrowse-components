---
id: httpbasicconfigschema
title: HTTPBasicConfigSchema
toplevel: true
---

### Slots

#### slot: tokenType

```js
tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: 'Basic',
    }
```

#### slot: validateWithHEAD

```js
validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    }
```

## Derives from

```js
baseConfiguration: BaseInternetAccountConfig
```
