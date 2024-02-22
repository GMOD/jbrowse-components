---
id: googledriveoauthinternetaccount
title: GoogleDriveOAuthInternetAccount
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/authentication/src/GoogleDriveOAuthModel/model.tsx](https://github.com/GMOD/jbrowse-components/blob/main/plugins/authentication/src/GoogleDriveOAuthModel/model.tsx)

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
