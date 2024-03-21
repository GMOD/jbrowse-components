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

#### slot: authHeader

```js
authHeader: {
      defaultValue: 'Authorization',
      description: 'request header for credentials',
      type: 'string',
    }
```

#### slot: description

```js
description: {
      defaultValue: '',
      description: 'a description of the internet account',
      type: 'string',
    }
```

#### slot: domains

```js
domains: {
      defaultValue: [],
      description:
        'array of valid domains the url can contain to use this account',
      type: 'stringArray',
    }
```

#### slot: name

```js
name: {
      defaultValue: '',
      description: 'descriptive name of the internet account',
      type: 'string',
    }
```

#### slot: tokenType

```js
tokenType: {
      defaultValue: '',
      description: 'a custom name for a token to include in the header',
      type: 'string',
    }
```
