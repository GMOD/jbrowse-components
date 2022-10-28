---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
toplevel: true
---

Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

## Docs

### HTTPBasicInternetAccount - Slots

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

## HTTPBasicInternetAccount - Derives from

```js
baseConfiguration: BaseInternetAccountConfig
```
