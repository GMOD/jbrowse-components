---
id: internetaccount
title: InternetAccount
toplevel: true
---

the "base" internet account type

### Slots

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
