---
id: assembly
title: Assembly
---

Note: this document is automatically generated from @jbrowse/mobx-state-tree
objects in our source code. See
[Core concepts and intro to pluggable elements](/docs/developer_guide/) for more
info

Also note: this document represents the state model API for the current released
version of jbrowse. If you are not using the current version, please cross
reference the markdown files in our repo of the checked out git tag

## Links

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assembly.ts)

[GitHub page](https://github.com/GMOD/jbrowse-components/tree/main/website/docs/models/Assembly.md)

## Docs

### Assembly - Properties

#### property: configuration

```js
// type signature
IMaybe<IReferenceType<IAnyType>>
// code
configuration: types.safeReference(assemblyConfigType)
```

### Assembly - Volatiles

#### volatile: error

```js
// type signature
unknown
// code
error
```

#### volatile: loadingP

```js
// type signature
Promise<void> | undefined
// code
loadingP: undefined as Promise<void> | undefined
```

#### volatile: volatileRegions

```js
// type signature
BasicRegion[] | undefined
// code
volatileRegions: undefined as BasicRegion[] | undefined
```

#### volatile: refNameAliases

```js
// type signature
RefNameAliases | undefined
// code
refNameAliases: undefined as RefNameAliases | undefined
```

#### volatile: canonicalToSeqAdapterRefNames

Maps canonical refName -> sequence adapter refName (in FASTA). These may differ
when refNameAliases with override:true remap names.

```js
// type signature
Record<string, string> | undefined
// code
canonicalToSeqAdapterRefNames: undefined as
          | Record<string, string>
          | undefined
```

#### volatile: cytobands

```js
// type signature
Feature[] | undefined
// code
cytobands: undefined as Feature[] | undefined
```

#### volatile: lowerCaseRefNameAliases

Precomputed in loadPre to avoid expensive synchronous computation when MobX
triggers the autorun after setLoaded

```js
// type signature
RefNameAliases | undefined
// code
lowerCaseRefNameAliases: undefined as RefNameAliases | undefined
```

#### volatile: allRefNamesWithLowerCase

Precomputed in loadPre to avoid expensive synchronous computation when MobX
triggers the autorun after setLoaded

```js
// type signature
Set<string> | undefined
// code
allRefNamesWithLowerCase: undefined as Set<string> | undefined
```

### Assembly - Getters

#### getter: name

```js
// type
string
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

#### getter: refNameColors

```js
// type
string[]
```

#### getter: allAliases

```js
// type
string[]
```

#### getter: initialized

this is a getter with a side effect of loading the data. not the best practice,
but it helps to lazy load the assembly

```js
// type
boolean
```

#### getter: regions

```js
// type
BasicRegion[] | undefined
```

#### getter: allRefNames

note: lowerCaseRefNameAliases not included here: this allows the list of
refnames to be just the "normal casing", but things like getCanonicalRefName can
resolve a lower-case name if needed

```js
// type
string[] | undefined
```

#### getter: rpcManager

```js
// type
RpcManager
```

#### getter: refNames

```js
// type
string[] | undefined
```

### Assembly - Methods

#### method: getConf

```js
// type signature
getConf: (arg: string) => any
```

#### method: hasName

```js
// type signature
hasName: (name: string) => boolean
```

#### method: getCanonicalRefName

Returns the canonical refName for a given alias or refName. Note: The canonical
name may differ from what's in the FASTA file when refNameAliases with
override:true are configured. To get the name that matches the FASTA file, use
getSeqAdapterRefName().

```js
// type signature
getCanonicalRefName: (refName: string) => string
```

#### method: getRefNameColor

```js
// type signature
getRefNameColor: (refName: string) => string | undefined
```

#### method: getSeqAdapterRefName

Given a canonical refName, returns the refName used by the sequence adapter
(what's in the FASTA file). Falls back to the input if no mapping exists.

```js
// type signature
getSeqAdapterRefName: (canonicalRefName: string) => string
```

#### method: getCanonicalRefName2

Returns canonical refName, falling back to input if not found. See
getCanonicalRefName() for details.

```js
// type signature
getCanonicalRefName2: (refName: string) => string
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
getRefNameMapForAdapter: (adapterConf: AdapterConf, opts: BaseOptions) => Promise<RefNameAliases>
```

#### method: getReverseRefNameMapForAdapter

get Map of `adapter-specific-name -> canonical-name`

```js
// type signature
getReverseRefNameMapForAdapter: (adapterConf: AdapterConf, opts: BaseOptions) => Promise<RefNameAliases>
```

### Assembly - Actions

#### action: setLoaded

Applies all load-time state in a single transaction so dependent autoruns fire
once, with the precomputed lowercase/name lookups already in place by the time
refNameAliases becomes observable.

```js
// type signature
setLoaded: ({ regions, refNameAliases, lowerCaseRefNameAliases, allRefNamesWithLowerCase, canonicalToSeqAdapterRefNames, cytobands, }: RefNameMaps & { regions: Region[]; cytobands: Feature[]; }) => void
```

#### action: setError

```js
// type signature
setError: (e: unknown) => void
```

#### action: setLoadingP

```js
// type signature
setLoadingP: (p?: Promise<void> | undefined) => void
```

#### action: loadPre

```js
// type signature
loadPre: () => Promise<void>
```

#### action: load

```js
// type signature
load: () => Promise<void>
```
