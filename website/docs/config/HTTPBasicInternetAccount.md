---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/HTTPBasicModel/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HTTPBasicInternetAccount.md)

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

### HTTPBasicInternetAccount - Derives from

```js
baseConfiguration: BaseInternetAccountConfig
```
