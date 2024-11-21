---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[plugins/authentication/src/ExternalTokenModel/configSchema.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/configSchema.ts)

### ExternalTokenInternetAccount - Slots

#### slot: validateWithHEAD

```js
validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    }
```

### ExternalTokenInternetAccount - Derives from

```js
baseConfiguration: BaseInternetAccountConfig
```
