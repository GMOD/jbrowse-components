---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
sidebar_label: Internet Account -> HTTPBasicInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

Also note: this document represents the config API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/HTTPBasicModel/configSchema.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/config/HTTPBasicInternetAccount.md)

## Overview

### HTTPBasicInternetAccount - Slots

#### slot: tokenType

```js
{
  description: 'a custom name for a token to include in the header',
  type: 'string',
  defaultValue: 'Basic',
}
```

#### slot: validateWithHEAD

```js
{
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
{
  description: 'descriptive name of the internet account',
  type: 'string',
  defaultValue: '',
}
```

#### slot: description

```js
{
  description: 'a description of the internet account',
  type: 'string',
  defaultValue: '',
}
```

#### slot: authHeader

```js
{
  description: 'request header for credentials',
  type: 'string',
  defaultValue: 'Authorization',
}
```

#### slot: tokenType

```js
{
  description: 'a custom name for a token to include in the header',
  type: 'string',
  defaultValue: '',
}
```

#### slot: domains

```js
{
  description:
    'array of valid domains the url can contain to use this account',
  type: 'stringArray',
  defaultValue: [],
}
```

### HTTPBasicInternetAccount - Derives from

- [BaseInternetAccount](../baseinternetaccount)

```js
baseConfiguration: BaseInternetAccountConfig
```
