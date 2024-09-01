---
id: addtrackmodel
title: AddTrackModel
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[plugins/data-management/src/AddTrackWidget/model.ts](https://github.com/GMOD/jbrowse-components/blob/main/plugins/data-management/src/AddTrackWidget/model.ts)

### AddTrackModel - Properties

#### property: id

```js
// type signature
IOptionalIType<ISimpleType<string>, [undefined]>
// code
id: ElementId
```

#### property: type

```js
// type signature
ISimpleType<"AddTrackWidget">
// code
type: types.literal('AddTrackWidget')
```

#### property: view

```js
// type signature
IMaybe<IReferenceType<IAnyType>>
// code
view: types.safeReference(
        pluginManager.pluggableMstType('view', 'stateModel'),
      )
```

### AddTrackModel - Getters

#### getter: trackAdapter

```js
// type
AdapterConfig
```

#### getter: trackName

```js
// type
string
```

#### getter: isFtp

```js
// type
boolean
```

#### getter: isRelativeTrackUrl

```js
// type
boolean
```

#### getter: isRelativeIndexUrl

```js
// type
boolean
```

#### getter: isRelativeUrl

```js
// type
any
```

#### getter: trackHttp

```js
// type
any
```

#### getter: indexHttp

```js
// type
any
```

#### getter: wrongProtocol

```js
// type
any
```

#### getter: unsupported

```js
// type
boolean
```

#### getter: assembly

```js
// type
any
```

#### getter: trackType

```js
// type
string
```

#### getter: warningMessage

```js
// type
"" | "Warning: JBrowse cannot access files using the ftp protocol" | "Warning: one or more of your files do not provide the protocol e.g.\n          https://, please provide an absolute URL unless you are sure a\n          relative URL is intended." | "Warning: You entered a http:// resources but we cannot access HT...
```

### AddTrackModel - Actions

#### action: setAdapterHint

```js
// type signature
setAdapterHint: (obj: string) => void
```

#### action: setTrackSource

```js
// type signature
setTrackSource: (str: string) => void
```

#### action: setTextIndexingConf

```js
// type signature
setTextIndexingConf: (conf: IndexingAttr) => void
```

#### action: setTextIndexTrack

```js
// type signature
setTextIndexTrack: (flag: boolean) => void
```

#### action: setTrackData

```js
// type signature
setTrackData: (obj: FileLocation) => void
```

#### action: setIndexTrackData

```js
// type signature
setIndexTrackData: (obj: FileLocation) => void
```

#### action: setAssembly

```js
// type signature
setAssembly: (str: string) => void
```

#### action: setTrackName

```js
// type signature
setTrackName: (str: string) => void
```

#### action: setTrackType

```js
// type signature
setTrackType: (str: string) => void
```

#### action: clearData

```js
// type signature
clearData: () => void
```
