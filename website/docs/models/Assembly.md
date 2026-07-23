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

| Member                                                                   | Kind       | Defined by | Description                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [configuration](#property-configuration)                                 | Properties | Assembly   |                                                                                                                                                                                                  |
| [error](#volatile-error)                                                 | Volatiles  | Assembly   |                                                                                                                                                                                                  |
| [loadingP](#volatile-loadingp)                                           | Volatiles  | Assembly   |                                                                                                                                                                                                  |
| [adapterLoads](#volatile-adapterloads)                                   | Volatiles  | Assembly   |                                                                                                                                                                                                  |
| [volatileRegions](#volatile-volatileregions)                             | Volatiles  | Assembly   |                                                                                                                                                                                                  |
| [refNameAliases](#volatile-refnamealiases)                               | Volatiles  | Assembly   |                                                                                                                                                                                                  |
| [canonicalToSeqAdapterRefNames](#volatile-canonicaltoseqadapterrefnames) | Volatiles  | Assembly   | Maps canonical refName -> sequence adapter refName (in FASTA).                                                                                                                                   |
| [cytobands](#volatile-cytobands)                                         | Volatiles  | Assembly   |                                                                                                                                                                                                  |
| [loadedGeneticCodes](#volatile-loadedgeneticcodes)                       | Volatiles  | Assembly   | refName -> NCBI genetic-code id loaded from `geneticCodesLocation`; merged with (and overridden by) the inline `geneticCodes` config slot                                                        |
| [lowerCaseRefNameAliases](#volatile-lowercaserefnamealiases)             | Volatiles  | Assembly   | Precomputed in loadPre to avoid expensive synchronous computation when MobX triggers the autorun after setLoaded                                                                                 |
| [name](#getter-name)                                                     | Getters    | Assembly   |                                                                                                                                                                                                  |
| [aliases](#getter-aliases)                                               | Getters    | Assembly   |                                                                                                                                                                                                  |
| [displayName](#getter-displayname)                                       | Getters    | Assembly   |                                                                                                                                                                                                  |
| [refNameColors](#getter-refnamecolors)                                   | Getters    | Assembly   |                                                                                                                                                                                                  |
| [allAliases](#getter-allaliases)                                         | Getters    | Assembly   |                                                                                                                                                                                                  |
| [initialized](#getter-initialized)                                       | Getters    | Assembly   |                                                                                                                                                                                                  |
| [regions](#getter-regions)                                               | Getters    | Assembly   |                                                                                                                                                                                                  |
| [allRefNames](#getter-allrefnames)                                       | Getters    | Assembly   | note: lowerCaseRefNameAliases not included here: this allows the list of refnames to be just the "normal casing", but things like getCanonicalRefName can resolve a lower-case name if needed    |
| [rpcManager](#getter-rpcmanager)                                         | Getters    | Assembly   |                                                                                                                                                                                                  |
| [refNames](#getter-refnames)                                             | Getters    | Assembly   |                                                                                                                                                                                                  |
| [refNameToIndex](#getter-refnametoindex)                                 | Getters    | Assembly   | memoized refName -> first region index, so getRefNameColor is O(1) instead of an O(n) indexOf per call (matters for assemblies with many contigs rendered in overview scalebars/rulers)          |
| [getConf](#method-getconf)                                               | Methods    | Assembly   |                                                                                                                                                                                                  |
| [hasName](#method-hasname)                                               | Methods    | Assembly   |                                                                                                                                                                                                  |
| [getCanonicalRefName](#method-getcanonicalrefname)                       | Methods    | Assembly   | Returns the canonical refName for a given alias or refName.                                                                                                                                      |
| [getRefNameColor](#method-getrefnamecolor)                               | Methods    | Assembly   |                                                                                                                                                                                                  |
| [getGeneticCodeId](#method-getgeneticcodeid)                             | Methods    | Assembly   | NCBI genetic-code (translation table) id for a refName, from the assembly's `geneticCodes` config map (e.g. a mitochondrial contig = 2).                                                         |
| [getSeqAdapterRefName](#method-getseqadapterrefname)                     | Methods    | Assembly   | Given a canonical refName, returns the refName used by the sequence adapter (what's in the FASTA file).                                                                                          |
| [getCanonicalRefName2](#method-getcanonicalrefname2)                     | Methods    | Assembly   | Returns canonical refName, falling back to input if not found.                                                                                                                                   |
| [isValidRefName](#method-isvalidrefname)                                 | Methods    | Assembly   |                                                                                                                                                                                                  |
| [getRefNameMapForAdapter](#method-getrefnamemapforadapter)               | Methods    | Assembly   | get Map of `canonical-name -> adapter-specific-name`, memoized per adapter config so concurrent callers share one load                                                                           |
| [setLoaded](#action-setloaded)                                           | Actions    | Assembly   | Applies all load-time state in a single transaction so dependent autoruns fire once, with the precomputed lowercase/name lookups already in place by the time refNameAliases becomes observable. |
| [setError](#action-seterror)                                             | Actions    | Assembly   |                                                                                                                                                                                                  |
| [setLoadingP](#action-setloadingp)                                       | Actions    | Assembly   |                                                                                                                                                                                                  |
| [loadPre](#action-loadpre)                                               | Actions    | Assembly   |                                                                                                                                                                                                  |
| [load](#action-load)                                                     | Actions    | Assembly   | Resolves once regions + refNameAliases are set, and rejects with the load failure.                                                                                                               |

<details>
<summary>Assembly - Properties</summary>

| Member                                                 | Type                               |
| ------------------------------------------------------ | ---------------------------------- |
| <span id="property-configuration">configuration</span> | `IMaybe<IReferenceType<IAnyType>>` |

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

| Member                                                     | Type                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| <span id="volatile-error">error</span>                     | `unknown`                                   |
| <span id="volatile-loadingp">loadingP</span>               | `Promise<void> \| undefined`                |
| <span id="volatile-adapterloads">adapterLoads</span>       | `QuickLRU<string, Promise<RefNameAliases>>` |
| <span id="volatile-volatileregions">volatileRegions</span> | `BasicRegion[] \| undefined`                |
| <span id="volatile-refnamealiases">refNameAliases</span>   | `RefNameAliases \| undefined`               |
| <span id="volatile-cytobands">cytobands</span>             | `Feature[] \| undefined`                    |

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

| Member                                               | Type                         |
| ---------------------------------------------------- | ---------------------------- |
| <span id="getter-name">name</span>                   | `string`                     |
| <span id="getter-aliases">aliases</span>             | `string[]`                   |
| <span id="getter-displayname">displayName</span>     | `string`                     |
| <span id="getter-refnamecolors">refNameColors</span> | `string[]`                   |
| <span id="getter-allaliases">allAliases</span>       | `string[]`                   |
| <span id="getter-initialized">initialized</span>     | `boolean`                    |
| <span id="getter-regions">regions</span>             | `BasicRegion[] \| undefined` |
| <span id="getter-rpcmanager">rpcManager</span>       | `RpcManager`                 |
| <span id="getter-refnames">refNames</span>           | `string[] \| undefined`      |

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

| Member                                                   | Type                                       |
| -------------------------------------------------------- | ------------------------------------------ |
| <span id="method-getconf">getConf</span>                 | `(arg: string) => any`                     |
| <span id="method-hasname">hasName</span>                 | `(name: string) => boolean`                |
| <span id="method-getrefnamecolor">getRefNameColor</span> | `(refName: string) => string \| undefined` |
| <span id="method-isvalidrefname">isValidRefName</span>   | `(refName: string) => boolean`             |

</details>

<details>
<summary>Assembly - Actions</summary>

#### action: setLoaded

Applies all load-time state in a single transaction so dependent autoruns fire
once, with the precomputed lowercase/name lookups already in place by the time
refNameAliases becomes observable.

```ts
type setLoaded = ({…}: RefNameMaps & { regions: Region[]; cytobands: Feature[]; geneticCodes: Record<…>; }) => void
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

| Member                                           | Type                                       |
| ------------------------------------------------ | ------------------------------------------ |
| <span id="action-seterror">setError</span>       | `(e: unknown) => void`                     |
| <span id="action-setloadingp">setLoadingP</span> | `(p?: Promise<void> \| undefined) => void` |
| <span id="action-loadpre">loadPre</span>         | `() => Promise<void>`                      |

</details>
