---
id: assembly
title: Assembly
sidebar_label: Assembly Management -> Assembly
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release —
see [pluggable elements](/docs/developer_guide/) for concepts. Built into
JBrowse core.
[View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assembly.ts).

## Overview

## Members

| Member                                                                   | Kind       | Defined by | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [configuration](#property-configuration)                                 | Properties | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [error](#volatile-error)                                                 | Volatiles  | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [loadingP](#volatile-loadingp)                                           | Volatiles  | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [adapterLoads](#volatile-adapterloads)                                   | Volatiles  | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [volatileRegions](#volatile-volatileregions)                             | Volatiles  | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [refNameAliases](#volatile-refnamealiases)                               | Volatiles  | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [canonicalToSeqAdapterRefNames](#volatile-canonicaltoseqadapterrefnames) | Volatiles  | Assembly   | Maps canonical refName -> sequence adapter refName (in FASTA). These may differ when refNameAliases with override:true remap names.                                                                                                                                                                                                                                                                                                                                                                                       |
| [cytobands](#volatile-cytobands)                                         | Volatiles  | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [loadedGeneticCodes](#volatile-loadedgeneticcodes)                       | Volatiles  | Assembly   | refName -> NCBI genetic-code id loaded from `geneticCodesLocation`; merged with (and overridden by) the inline `geneticCodes` config slot                                                                                                                                                                                                                                                                                                                                                                                 |
| [lowerCaseRefNameAliases](#volatile-lowercaserefnamealiases)             | Volatiles  | Assembly   | Precomputed in loadPre to avoid expensive synchronous computation when MobX triggers the autorun after setLoaded                                                                                                                                                                                                                                                                                                                                                                                                          |
| [name](#getter-name)                                                     | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [aliases](#getter-aliases)                                               | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [displayName](#getter-displayname)                                       | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [refNameColors](#getter-refnamecolors)                                   | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [allAliases](#getter-allaliases)                                         | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [initialized](#getter-initialized)                                       | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [regions](#getter-regions)                                               | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [allRefNames](#getter-allrefnames)                                       | Getters    | Assembly   | note: lowerCaseRefNameAliases not included here: this allows the list of refnames to be just the "normal casing", but things like getCanonicalRefName can resolve a lower-case name if needed                                                                                                                                                                                                                                                                                                                             |
| [rpcManager](#getter-rpcmanager)                                         | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [refNames](#getter-refnames)                                             | Getters    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [refNameToIndex](#getter-refnametoindex)                                 | Getters    | Assembly   | memoized refName -> first region index, so getRefNameColor is O(1) instead of an O(n) indexOf per call (matters for assemblies with many contigs rendered in overview scalebars/rulers)                                                                                                                                                                                                                                                                                                                                   |
| [getConf](#method-getconf)                                               | Methods    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [hasName](#method-hasname)                                               | Methods    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [getCanonicalRefName](#method-getcanonicalrefname)                       | Methods    | Assembly   | Returns the canonical refName for a given alias or refName. Note: The canonical name may differ from what's in the FASTA file when refNameAliases with override:true are configured. To get the name that matches the FASTA file, use getSeqAdapterRefName().                                                                                                                                                                                                                                                             |
| [getRefNameColor](#method-getrefnamecolor)                               | Methods    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [getGeneticCodeId](#method-getgeneticcodeid)                             | Methods    | Assembly   | NCBI genetic-code (translation table) id for a refName, from the assembly's `geneticCodes` config map (e.g. a mitochondrial contig = 2). Falls back to the standard code (1) for unlisted refNames.                                                                                                                                                                                                                                                                                                                       |
| [getSeqAdapterRefName](#method-getseqadapterrefname)                     | Methods    | Assembly   | Given a canonical refName, returns the refName used by the sequence adapter (what's in the FASTA file). Falls back to the input if no mapping exists.                                                                                                                                                                                                                                                                                                                                                                     |
| [getCanonicalRefName2](#method-getcanonicalrefname2)                     | Methods    | Assembly   | Returns canonical refName, falling back to input if not found. See getCanonicalRefName() for details.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| [isValidRefName](#method-isvalidrefname)                                 | Methods    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [getRefNameMapForAdapter](#method-getrefnamemapforadapter)               | Methods    | Assembly   | get Map of `canonical-name -> adapter-specific-name`, memoized per adapter config so concurrent callers share one load                                                                                                                                                                                                                                                                                                                                                                                                    |
| [setLoaded](#action-setloaded)                                           | Actions    | Assembly   | Applies all load-time state in a single transaction so dependent autoruns fire once, with the precomputed lowercase/name lookups already in place by the time refNameAliases becomes observable.                                                                                                                                                                                                                                                                                                                          |
| [setError](#action-seterror)                                             | Actions    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [setLoadingP](#action-setloadingp)                                       | Actions    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [loadPre](#action-loadpre)                                               | Actions    | Assembly   |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [load](#action-load)                                                     | Actions    | Assembly   | Resolves once regions + refNameAliases are set, and rejects with the load failure. Idempotent: concurrent callers share one attempt, and a failed attempt is discarded so the next call retries. The rejection is the authoritative signal for a caller that awaits it. `self.error` mirrors it for reactive consumers only (the UI renders it), and must not be consulted after an await: a concurrent retry clears it, so an awaiter reading it can see a cleared error and mistake a failed load for a successful one. |

<details>
<summary>Assembly - Properties</summary>

#### property: configuration

```ts
// type signature
type configuration = IMaybe<IReferenceType<IAnyType>>
// code
configuration: types.safeReference(assemblyConfigType)
```

</details>

<details>
<summary>Assembly - Volatiles</summary>

#### volatile: canonicalToSeqAdapterRefNames

Maps canonical refName -> sequence adapter refName (in FASTA). These may differ
when refNameAliases with override:true remap names.

```ts
// type signature
type canonicalToSeqAdapterRefNames = Record<string, string> | undefined
// code
canonicalToSeqAdapterRefNames: undefined as Record<string, string> | undefined
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

</details>

<details>
<summary>Assembly - Volatiles (other undocumented members)</summary>

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

#### volatile: cytobands

```ts
// type signature
type cytobands = Feature[] | undefined
// code
cytobands: undefined as Feature[] | undefined
```

</details>

<details>
<summary>Assembly - Getters</summary>

#### getter: allRefNames

note: lowerCaseRefNameAliases not included here: this allows the list of
refnames to be just the "normal casing", but things like getCanonicalRefName can
resolve a lower-case name if needed

```ts
type allRefNames = string[] | undefined
```

#### getter: refNameToIndex

memoized refName -> first region index, so getRefNameColor is O(1) instead of an
O(n) indexOf per call (matters for assemblies with many contigs rendered in
overview scalebars/rulers)

```ts
type refNameToIndex = Map<string, number> | undefined
```

</details>

<details>
<summary>Assembly - Getters (other undocumented members)</summary>

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

#### getter: rpcManager

```ts
type rpcManager = RpcManager
```

#### getter: refNames

```ts
type refNames = string[] | undefined
```

</details>

<details>
<summary>Assembly - Methods</summary>

#### method: getCanonicalRefName

Returns the canonical refName for a given alias or refName. Note: The canonical
name may differ from what's in the FASTA file when refNameAliases with
override:true are configured. To get the name that matches the FASTA file, use
getSeqAdapterRefName().

```ts
type getCanonicalRefName = (refName: string) => string
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

<details>
<summary>Assembly - Methods (other undocumented members)</summary>

#### method: getConf

```ts
type getConf = (arg: string) => any
```

#### method: hasName

```ts
type hasName = (name: string) => boolean
```

#### method: getRefNameColor

```ts
type getRefNameColor = (refName: string) => string | undefined
```

#### method: isValidRefName

```ts
type isValidRefName = (refName: string) => boolean
```

</details>

<details>
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
  canonicalToSeqAdapterRefNames,
  cytobands,
  geneticCodes,
}: RefNameMaps & {
  regions: Region[]
  cytobands: Feature[]
  geneticCodes: Record<string, number>
}) => void
```

#### action: load

Resolves once regions + refNameAliases are set, and rejects with the load
failure. Idempotent: concurrent callers share one attempt, and a failed attempt
is discarded so the next call retries.

The rejection is the authoritative signal for a caller that awaits it.
`self.error` mirrors it for reactive consumers only (the UI renders it), and
must not be consulted after an await: a concurrent retry clears it, so an
awaiter reading it can see a cleared error and mistake a failed load for a
successful one.

```ts
type load = () => Promise<void>
```

</details>

<details>
<summary>Assembly - Actions (other undocumented members)</summary>

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

</details>
