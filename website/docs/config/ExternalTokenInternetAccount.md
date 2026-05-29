---
id: externaltokeninternetaccount
title: ExternalTokenInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/ExternalTokenModel/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/ExternalTokenInternetAccount.md)

## Docs

### ExternalTokenInternetAccount - Slots

#### slot: validateWithHEAD

```js
validateWithHEAD: {
      description: 'validate the token with a HEAD request before using it',
      type: 'boolean',
      defaultValue: true,
    }
```

## Inherited config slots

Slots available on this config via its base configuration(s), shown in full so
this page is self-contained.

### Inherited from [BaseInternetAccount](../baseinternetaccount)

#### slot: name

```js
name: {
      description: 'descriptive name of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: description

```js
description: {
      description: 'a description of the internet account',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: authHeader

```js
authHeader: {
      description: 'request header for credentials',
      type: 'string',
      defaultValue: 'Authorization',
    }
```

#### slot: tokenType

```js
tokenType: {
      description: 'a custom name for a token to include in the header',
      type: 'string',
      defaultValue: '',
    }
```

#### slot: domains

```js
domains: {
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
      defaultValue: [],
    }
```

### ExternalTokenInternetAccount - Derives from

- [BaseInternetAccount](../baseinternetaccount)

```js
baseConfiguration: BaseInternetAccountConfig
```
