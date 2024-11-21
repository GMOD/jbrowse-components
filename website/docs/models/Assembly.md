---
id: assembly
title: Assembly
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

### Source file

[packages/core/assemblyManager/assembly.ts](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/assemblyManager/assembly.ts)

### Assembly - Properties

#### property: configuration

```js
// type signature
IMaybe<IReferenceType<IAnyType>>
// code
configuration: types.safeReference(assemblyConfigType)
```

### Assembly - Getters

#### getter: initialized

```js
// type
boolean
```

#### getter: name

```js
// type
string
```

#### getter: regions

```js
// type
BasicRegion[]
```

#### getter: aliases

```js
// type
string[]
```

#### getter: displayName

```js
// type
string
```

#### getter: hasName

```js
// type
(name: string) => any
```

#### getter: allAliases

```js
// type
any[]
```

#### getter: allRefNames

note: lowerCaseRefNameAliases not included here: this allows the list of
refnames to be just the "normal casing", but things like getCanonicalRefName can
resolve a lower-case name if needed

```js
// type
string[]
```

#### getter: lowerCaseRefNames

```js
// type
string[]
```

#### getter: allRefNamesWithLowerCase

```js
// type
any[]
```

#### getter: rpcManager

```js
// type
RpcManager
```

#### getter: refNameColors

```js
// type
string[]
```

#### getter: refNames

```js
// type
string[]
```

### Assembly - Methods

#### method: getConf

```js
// type signature
getConf: (arg: string) => any
```

#### method: getCanonicalRefName

```js
// type signature
getCanonicalRefName: (refName: string) => string
```

#### method: getRefNameColor

```js
// type signature
getRefNameColor: (refName: string) => string
```

#### method: isValidRefName

```js
// type signature
isValidRefName: (refName: string) => boolean
```

#### method: getAdapterMapEntry

```js
// type signature
getAdapterMapEntry: (adapterConf: AdapterConf, options: BaseOptions) => Promise<RefNameMap>
```

#### method: getRefNameMapForAdapter

get Map of `canonical-name -> adapter-specific-name`

```js
// type signature
getRefNameMapForAdapter: (adapterConf: AdapterConf, opts: BaseOptions) => Promise<any>
```

#### method: getReverseRefNameMapForAdapter

get Map of `adapter-specific-name -> canonical-name`

```js
// type signature
getReverseRefNameMapForAdapter: (adapterConf: AdapterConf, opts: BaseOptions) => Promise<any>
```

### Assembly - Actions

#### action: setLoaded

```js
// type signature
setLoaded: ({ regions, refNameAliases, lowerCaseRefNameAliases, cytobands, }: { regions: Region[]; refNameAliases: RefNameAliases; lowerCaseRefNameAliases: RefNameAliases; cytobands: Feature[]; }) => void
```

#### action: setError

```js
// type signature
setError: (e: unknown) => void
```

#### action: setRegions

```js
// type signature
setRegions: (regions: Region[]) => void
```

#### action: setRefNameAliases

```js
// type signature
setRefNameAliases: (aliases: RefNameAliases, lowerCaseAliases: RefNameAliases) => void
```

#### action: setCytobands

```js
// type signature
setCytobands: (cytobands: Feature[]) => void
```

#### action: setLoadingP

```js
// type signature
setLoadingP: (p?: Promise<void>) => void
```

#### action: load

```js
// type signature
load: () => Promise<void>
```

#### action: loadPre

```js
// type signature
loadPre: () => Promise<void>
```
