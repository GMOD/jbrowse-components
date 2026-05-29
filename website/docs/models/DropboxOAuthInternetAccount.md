---
id: dropboxoauthinternetaccount
title: DropboxOAuthInternetAccount
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/DropboxOAuthModel/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/DropboxOAuthInternetAccount.md)

## Docs

### DropboxOAuthInternetAccount - Properties

#### property: type

```js
// type signature
ISimpleType<"DropboxOAuthInternetAccount">
// code
type: types.literal('DropboxOAuthInternetAccount')
```

#### property: configuration

```js
// type signature
ITypeUnion<any, any, any>
// code
configuration: ConfigurationReference(configSchema)
```

### DropboxOAuthInternetAccount - Getters

#### getter: toggleContents

The FileSelector icon for Dropbox

```js
// type
Element
```

#### getter: selectorLabel

```js
// type
string
```

### DropboxOAuthInternetAccount - Methods

#### method: getFetcher

```js
// type signature
getFetcher: (location?: UriLocation | undefined) => (input: RequestInfo, init?: RequestInit | undefined) => Promise<Response>
```

### DropboxOAuthInternetAccount - Actions

#### action: validateToken

```js
// type signature
validateToken: (token: string, location: UriLocation) => Promise<string>
```
