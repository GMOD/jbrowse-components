---
id: httpbasicinternetaccount
title: HTTPBasicInternetAccount
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/HTTPBasicModel/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/HTTPBasicInternetAccount.md)

## Docs

### HTTPBasicInternetAccount - Properties

#### propertie: type

```js
// type signature
ISimpleType<"HTTPBasicInternetAccount">
// code
type: types.literal('HTTPBasicInternetAccount')
```

#### propertie: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### HTTPBasicInternetAccount - Getters

#### getter: validateWithHEAD

```js
// type
boolean
```

### HTTPBasicInternetAccount - Actions

#### action: getTokenFromUser

```js
// type signature
getTokenFromUser: (resolve: (token: string) => void, reject: (error: Error) => void) => void
```

#### action: validateToken

```js
// type signature
validateToken: (token: string, location: UriLocation) => Promise<string>
```
