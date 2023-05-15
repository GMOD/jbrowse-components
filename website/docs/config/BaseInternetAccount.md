---
id: baseinternetaccount
title: BaseInternetAccount
---

Note: this document is automatically generated from configuration objects in our
source code. See [Config guide](/docs/config_guide) for more info

### Source file

[packages/core/pluggableElementTypes/models/baseInternetAccountConfig.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/pluggableElementTypes/models/baseInternetAccountConfig.ts)

the "base" internet account type

### BaseInternetAccount - Identifier

#### slot: explicitIdentifier

### BaseInternetAccount - Slots

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
