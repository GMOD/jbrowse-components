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

#### property: configuration

```js
// type signature
ConfigurationSchemaType<{ authEndpoint: { defaultValue: string; description: string; type: string; }; domains: { defaultValue: string[]; description: string; type: string; }; responseType: { defaultValue: string; description: string; type: string; }; scopes: { ...; }; }, ConfigurationSchemaOptions<...>>
// code
configuration: ConfigurationReference(configSchema)
```

#### property: type

```js
// type signature
ISimpleType<"GoogleDriveOAuthInternetAccount">
// code
type: types.literal('GoogleDriveOAuthInternetAccount')
```

### GoogleDriveOAuthInternetAccount - Getters

#### getter: selectorLabel

```js
// type
string
```

#### getter: toggleContents

The FileSelector icon for Google drive

```js
// type
Element
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
