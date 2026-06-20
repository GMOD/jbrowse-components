---
id: assembly
title: Assembly
sidebar_label: Assembly Management -> Assembly
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

## Overview

<details open>
<summary>Assembly - Properties</summary>

#### property: configuration

```ts
// type signature
type configuration = IMaybe<IReferenceType<IAnyType>>
// code
configuration: types.safeReference(assemblyConfigType)
```

</details>

<details open>
<summary>Assembly - Volatiles</summary>

#### volatile: error

```ts
// type signature
type error = unknown
// code
error
```

#### volatile: loadingP

```ts
// type signature
type loadingP = Promise<void> | undefined
// code
loadingP: undefined as Promise<void> | undefined
```

#### volatile: adapterLoads

```ts
// type signature
type adapterLoads = QuickLRU<string, Promise<RefNameAliases>>
// code
adapterLoads: new QuickLRU<string, Promise<RefNameAliases>>({
  maxSize: 1000,
})
```

#### volatile: volatileRegions

```ts
// type signature
type volatileRegions = BasicRegion[] | undefined
// code
volatileRegions: undefined as BasicRegion[] | undefined
```

#### volatile: refNameAliases

```ts
// type signature
type refNameAliases = RefNameAliases | undefined
// code
refNameAliases: undefined as RefNameAliases | undefined
```

#### volatile: canonicalToSeqAdapterRefNames

Maps canonical refName -> sequence adapter refName (in FASTA). These may differ
when refNameAliases with override:true remap names.

```ts
// type signature
type canonicalToSeqAdapterRefNames = Record<string, string> | undefined
// code
canonicalToSeqAdapterRefNames: undefined as Record<string, string> | undefined
```

#### volatile: cytobands

```ts
// type signature
type cytobands = Feature[] | undefined
// code
cytobands: undefined as Feature[] | undefined
```

#### volatile: loadedGeneticCodes

refName -> NCBI genetic-code id loaded from `geneticCodesLocation`; merged with
(and overridden by) the inline `geneticCodes` config slot

```ts
// type signature
type loadedGeneticCodes = Record<string, number> | undefined
// code
loadedGeneticCodes: undefined as Record<string, number> | undefined
```

#### volatile: lowerCaseRefNameAliases

Precomputed in loadPre to avoid expensive synchronous computation when MobX
triggers the autorun after setLoaded

```ts
// type signature
type lowerCaseRefNameAliases = RefNameAliases | undefined
// code
lowerCaseRefNameAliases: undefined as RefNameAliases | undefined
```

#### volatile: allRefNamesWithLowerCase

Precomputed in loadPre to avoid expensive synchronous computation when MobX
triggers the autorun after setLoaded

```ts
// type signature
type allRefNamesWithLowerCase = Set<string> | undefined
// code
allRefNamesWithLowerCase: undefined as Set<string> | undefined
```

</details>

<details open>
<summary>Assembly - Getters</summary>

#### getter: name

```ts
type name = string
```

#### getter: aliases

```ts
type aliases = string[]
```

#### getter: displayName

```ts
type displayName = string
```

#### getter: refNameColors

```ts
type refNameColors = string[]
```

#### getter: allAliases

```ts
type allAliases = string[]
```

#### getter: initialized

```ts
type initialized = boolean
```

#### getter: regions

```ts
type regions = BasicRegion[] | undefined
```

#### getter: allRefNames

note: lowerCaseRefNameAliases not included here: this allows the list of
refnames to be just the "normal casing", but things like getCanonicalRefName can
resolve a lower-case name if needed

```ts
type allRefNames = string[] | undefined
```

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

#### getter: refNames

```ts
type refNames = string[] | undefined
```

#### getter: refNameToIndex

memoized refName -> first region index, so getRefNameColor is O(1) instead of an
O(n) indexOf per call (matters for assemblies with many contigs rendered in
overview scalebars/rulers)

```ts
type refNameToIndex = Map<string, number> | undefined
```

</details>

<details open>
<summary>Assembly - Methods</summary>

#### method: getConf

```ts
type getConf = (arg: string) => any
```

#### method: hasName

```ts
type hasName = (name: string) => boolean
```

#### method: getCanonicalRefName

Returns the canonical refName for a given alias or refName. Note: The canonical
name may differ from what's in the FASTA file when refNameAliases with
override:true are configured. To get the name that matches the FASTA file, use
getSeqAdapterRefName().

```ts
type getCanonicalRefName = (refName: string) => string
```

#### method: getRefNameColor

```ts
type getRefNameColor = (refName: string) => string | undefined
```

#### method: getGeneticCodeId

NCBI genetic-code (translation table) id for a refName, from the assembly's
`geneticCodes` config map (e.g. a mitochondrial contig = 2). Falls back to the
standard code (1) for unlisted refNames.

```ts
type getGeneticCodeId = (refName: string) => number
```

#### method: getSeqAdapterRefName

Given a canonical refName, returns the refName used by the sequence adapter
(what's in the FASTA file). Falls back to the input if no mapping exists.

```ts
type getSeqAdapterRefName = (canonicalRefName: string) => string
```

#### method: getCanonicalRefName2

Returns canonical refName, falling back to input if not found. See
getCanonicalRefName() for details.

```ts
type getCanonicalRefName2 = (refName: string) => string
```

#### method: isValidRefName

```ts
type isValidRefName = (refName: string) => boolean
```

#### method: getRefNameMapForAdapter

get Map of `canonical-name -> adapter-specific-name`, memoized per adapter
config so concurrent callers share one load

```ts
type getRefNameMapForAdapter = (
  adapterConf: AdapterConf,
  options: BaseOptions,
) => Promise<RefNameAliases>
```

</details>

<details open>
<summary>Assembly - Actions</summary>

#### action: setLoaded

Applies all load-time state in a single transaction so dependent autoruns fire
once, with the precomputed lowercase/name lookups already in place by the time
refNameAliases becomes observable.

```ts
type setLoaded = ({
  regions,
  refNameAliases,
  lowerCaseRefNameAliases,
  allRefNamesWithLowerCase,
  canonicalToSeqAdapterRefNames,
  cytobands,
  geneticCodes,
}: RefNameMaps & {
  regions: Region[]
  cytobands: Feature[]
  geneticCodes: Record<string, number>
}) => void
```

#### action: setError

```ts
type setError = (e: unknown) => void
```

#### action: setLoadingP

```ts
type setLoadingP = (p?: Promise<void> | undefined) => void
```

#### action: loadPre

```ts
type loadPre = () => Promise<void>
```

#### action: load

```ts
type load = () => Promise<void>
```

</details>
