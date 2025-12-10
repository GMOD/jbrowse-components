---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/GoogleDriveOAuthModel/model.tsx)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/GoogleDriveOAuthInternetAccount.md)

## Docs

### GoogleDriveOAuthInternetAccount - Properties

#### property: type

```js
// type signature
ISimpleType<"GoogleDriveOAuthInternetAccount">
// code
type: types.literal('GoogleDriveOAuthInternetAccount')
```

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ authEndpoint: { description: string; type: string; defaultValue: string; }; scopes: { description: string; type: string; defaultValue: string; }; domains: { description: string; type: string; defaultValue: string[]; }; responseType: { ...; }; }, ConfigurationSchemaOptions<...>>
// code
configuration: ConfigurationReference(configSchema)
```

### GoogleDriveOAuthInternetAccount - Getters

#### getter: toggleContents

The FileSelector icon for Google drive

```js
// type
Element
```

#### getter: selectorLabel

```js
// type
string
```

### GoogleDriveOAuthInternetAccount - Methods

#### method: getFetcher

```js
// type signature
getFetcher: (location?: UriLocation) => (input: RequestInfo, init?: RequestInitWithMetadata) => Promise<Response>
```

#### method: openLocation

```js
// type signature
openLocation: (location: UriLocation) => GoogleDriveFile
```

### GoogleDriveOAuthInternetAccount - Actions

#### action: validateToken

```js
// type signature
validateToken: (token: string, location: UriLocation) => Promise<string>
```
