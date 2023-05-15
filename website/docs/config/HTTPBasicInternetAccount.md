---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/authentication/src/HTTPBasicModel/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/HTTPBasicModel/configSchema.ts)

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

### HTTPBasicInternetAccount - Derives from

```js
baseConfiguration: BaseInternetAccountConfig
```
