---
id: assembly
title: Assembly
sidebar_label: Assembly Management -> Assembly
---

Auto-generated @jbrowse/mobx-state-tree API for the current JBrowse release — see [pluggable elements](/docs/developer_guide/) for concepts. Built into JBrowse core. [View source](https://github.com/GMOD/jbrowse-components/blob/main/packages/core/src/assemblyManager/assembly.ts).

## Properties

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="property-configuration">**configuration**</span><br><code>configuration: types.safeReference(assemblyConfigType)</code> |  |

## Volatiles

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="volatile-error">**error**</span><br><code>error</code> |  |
| <span id="volatile-loadingp">**loadingP**</span><br><code>loadingP: undefined as Promise&lt;void&gt; &#124; undefined</code> |  |
| <span id="volatile-adapterloads">**adapterLoads**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>adapterLoads: new QuickLRU&lt;string, Promise&lt;RefNameAliases&gt;&gt;({ m…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>adapterLoads: new QuickLRU&lt;string, Promise&lt;RefNameAliases&gt;&gt;({&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;maxSize: 1000,&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;})</code></pre></dialog></span> |  |
| <span id="volatile-volatileregions">**volatileRegions**</span><br><code>volatileRegions: undefined as BasicRegion[] &#124; undefined</code> |  |
| <span id="volatile-refnamealiases">**refNameAliases**</span><br><code>refNameAliases: undefined as RefNameAliases &#124; undefined</code> |  |
| <span id="volatile-canonicaltoseqadapterrefnames">**canonicalToSeqAdapterRefNames**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>canonicalToSeqAdapterRefNames: undefined as &#124; Record&lt;string, st…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>canonicalToSeqAdapterRefNames: undefined as&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; Record&lt;string, string&gt;&#10;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#160;&#124; undefined</code></pre></dialog></span> | Maps canonical refName -> sequence adapter refName (in FASTA). These may differ when refNameAliases with override:true remap names. |
| <span id="volatile-cytobands">**cytobands**</span><br><code>cytobands: undefined as Feature[] &#124; undefined</code> |  |
| <span id="volatile-loadedgeneticcodes">**loadedGeneticCodes**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>loadedGeneticCodes: undefined as Record&lt;string, number&gt; &#124; undef…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>loadedGeneticCodes: undefined as Record&lt;string, number&gt; &#124; undefined</code></pre></dialog></span> | refName -> NCBI genetic-code id loaded from `geneticCodesLocation`; merged with (and overridden by) the inline `geneticCodes` config slot |
| <span id="volatile-lowercaserefnamealiases">**lowerCaseRefNameAliases**</span><br><code>lowerCaseRefNameAliases: undefined as RefNameAliases &#124; undefined</code> | Precomputed in loadPre to avoid expensive synchronous computation when MobX triggers the autorun after setLoaded |
| <span id="volatile-statusmessage">**statusMessage**</span><br><code>statusMessage: undefined as string &#124; undefined</code> | What the in-flight load is doing ("Downloading chromosome sizes"), for a view that is showing a spinner while it waits. Same split as BaseDisplayModel's status fields, so the same LoadingProgress UI renders both. |
| <span id="volatile-statusprogress">**statusProgress**</span><br><code>statusProgress: undefined as number &#124; undefined</code> | Fraction in [0,1] when the load reports determinate progress |
| <span id="volatile-statussource">**statusSource**</span><br><code>statusSource: undefined as string &#124; undefined</code> | The URL the in-flight phase is fetching, when it named one. A load that hangs shows this and not the label: "Downloading chromosome aliases" forever says nothing a user can act on, and the address of the server that stopped answering does. |
| <span id="volatile-refnamemismatches">**refNameMismatches**</span><br><code>refNameMismatches: new Map&lt;string, RefNameMismatch&gt;()</code> | adapter cache key -> the empty-intersection verdict `loadRefNameMap` reached for that adapter under this assembly. Sits beside `adapterLoads` and is keyed the same way, so it inherits that cache's once-per-(assembly, adapter config) property: the diagnostic is recorded exactly as often as the map is built, which is once.<br><br>Written by replacing the Map rather than mutating it — a Map inside a volatile is one observable, not a deeply observable collection, so a `.set()` would leave every reader stale. |

## Getters

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="getter-name">**name**</span><br><code>string</code> |  |
| <span id="getter-aliases">**aliases**</span><br><code>string[]</code> |  |
| <span id="getter-displayname">**displayName**</span><br><code>string</code> |  |
| <span id="getter-refnamecolors">**refNameColors**</span><br><code>string[]</code> |  |
| <span id="getter-allaliases">**allAliases**</span><br><code>string[]</code> |  |
| <span id="getter-initialized">**initialized**</span><br><code>boolean</code> |  |
| <span id="getter-regions">**regions**</span><br><code>BasicRegion[] &#124; undefined</code> |  |
| <span id="getter-allrefnames">**allRefNames**</span><br><code>string[] &#124; undefined</code> | note: lowerCaseRefNameAliases not included here: this allows the list of refnames to be just the "normal casing", but things like getCanonicalRefName can resolve a lower-case name if needed |
| <span id="getter-namesbycanonicalrefname">**namesByCanonicalRefName**</span><br><code>Map&lt;string, string[]&gt; &#124; undefined</code> | canonical refName -> every name this assembly has for that sequence, canonical first. The inverse of `refNameAliases`, memoized here because the readers that want it want the whole table (the About dialog's alias listing) rather than one row. Undefined until the aliases load. |
| <span id="getter-rpcmanager">**rpcManager**</span><br><code>RpcManager</code> |  |
| <span id="getter-refnames">**refNames**</span><br><code>string[] &#124; undefined</code> |  |
| <span id="getter-refnametoindex">**refNameToIndex**</span><br><code>Map&lt;string, number&gt; &#124; undefined</code> | memoized refName -> first region index, so getRefNameColor is O(1) instead of an O(n) indexOf per call (matters for assemblies with many contigs rendered in overview scalebars/rulers) |

## Methods

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="method-getconf">**getConf**</span><br><code>(arg: string) =&gt; any</code> |  |
| <span id="method-hasname">**hasName**</span><br><code>(name: string) =&gt; boolean</code> |  |
| <span id="method-getcanonicalrefname">**getCanonicalRefName**</span><br><code>(refName: string) =&gt; string</code> | Returns the canonical refName for a given alias or refName. Note: The canonical name may differ from what's in the FASTA file when refNameAliases with override:true are configured. To get the name that matches the FASTA file, use getSeqAdapterRefName(). |
| <span id="method-getrefnamecolor">**getRefNameColor**</span><br><code>(refName: string) =&gt; string &#124; undefined</code> |  |
| <span id="method-getregionforrefname">**getRegionForRefName**</span><br><code>(refName: string) =&gt; BasicRegion &#124; undefined</code> | The whole-contig region for a CANONICAL refName — its extents, and so the bounds anything placing a span on it has to clamp into. Undefined before `regions` loads, and for a refName this assembly doesn't have.<br><br>Reads the `refNameToIndex` memo, which is why this exists rather than each caller writing `assembly.regions?.find(r => r.refName === name)`: five of them did, and that scan is O(contigs) per call on an assembly whose whole point is that it may have thousands. |
| <span id="method-getgeneticcodeid">**getGeneticCodeId**</span><br><code>(refName: string) =&gt; number</code> | NCBI genetic-code (translation table) id for a refName, from the assembly's `geneticCodes` config map (e.g. a mitochondrial contig = 2). Falls back to the standard code (1) for unlisted refNames. |
| <span id="method-getseqadapterrefname">**getSeqAdapterRefName**</span><br><code>(canonicalRefName: string) =&gt; string</code> | Given a canonical refName, returns the refName used by the sequence adapter (what's in the FASTA file). Falls back to the input if no mapping exists. |
| <span id="method-getcanonicalrefname2">**getCanonicalRefName2**</span><br><code>(refName: string) =&gt; string</code> | The total canonical-refName resolver, for any name arriving from outside — off a feature, out of an RPC result, out of a session spec. A name the assembly does not know comes back unchanged, and so does one asked for before the aliases load, where `getCanonicalRefName` answers `undefined` for the first and THROWS for the second.<br><br>The throw is the reason to call this rather than hand-roll `getCanonicalRefName(x) ?? x`: that idiom looks total and is not, and these resolutions sit in getters and render paths that run from the first frame, before the alias file has landed. Answering with the input there means the comparison downstream may miss, but it misses for one frame and re-runs, where a throw out of a getter takes the view down. `initialized` is the gate for a caller that needs to know which answer it got.<br><br>See getCanonicalRefName() for what canonical means when `refNameAliases` carries an `override`. |
| <span id="method-isvalidrefname">**isValidRefName**</span><br><code>(refName: string) =&gt; boolean</code> |  |
| <span id="method-getaliasesforrefname">**getAliasesForRefName**</span><br><code>(refName: string) =&gt; string[]</code> | The other names this assembly has for the same sequence as `refName` — its aliases, whether the name handed in is an alias or the canonical name. `chr1`, `1` and `NC_000001.11` each answer with the other two.<br><br>Empty for a name this assembly does not have, and also before the aliases load: this resolves through `getCanonicalRefName2` so it can be called from a render, and `initialized` is what distinguishes the two. |
| <span id="method-getrefnamemapforadapter">**getRefNameMapForAdapter**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>(adapterConf: AdapterConf, options: BaseOptions) =&gt; Promise&lt;Ref…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>(adapterConf: AdapterConf, options: BaseOptions) =&gt; Promise&lt;RefNameAliases&gt;</code></pre></dialog></span> | get Map of `canonical-name -> adapter-specific-name`, memoized per adapter config so concurrent callers share one load<br><br>The load reports progress (the adapter's index download, or for an in-memory adapter the whole file) through the `statusCallback` of whichever caller started it. The others await it silently, and that is deliberate rather than a gap worth plumbing around: the callers sharing an entry are almost always the N displayed regions of ONE display, so their callbacks all write into that display's aggregated status bar and the first one is already reporting on behalf of the rest. The costs of getting this "right" — a listener set per key, registration, and deregistration on settle — buy visibility only for a second display on the same file, and for a first caller torn down mid-load, which is a no-op rather than a hazard because the callbacks are `isAlive`-guarded at the display end.<br><br>If that ever stops being enough, the fix is not a subscription list bolted on here: it is for the assembly to hold the in-flight status as observable state that consumers read, which is what this model is already made of. |
| <span id="method-getrefnamemismatch">**getRefNameMismatch**</span><br><code>(adapterCacheKey: string) =&gt; RefNameMismatch &#124; undefined</code> | The empty-intersection verdict for an adapter under this assembly, if the map load reached one. Keyed by `adapterConfigCacheKey`, which is what a track already computes as its `rpcSessionId` — so a track looks up its own diagnostic with no plumbing between here and it. Undefined until the map has loaded, which is the same instant the track's first fetch resolves. |

## Actions

<!-- prettier-ignore -->
| Member | Description |
| --- | --- |
| <span id="action-setstatus">**setStatus**</span><br><code>(status?: RpcStatus &#124; undefined) =&gt; void</code> | Records what the in-flight load is doing. Its own actions block (rather than sitting next to setLoaded) so loadPre can hand `self.setStatus` to the adapters as a plain callback: it fires after awaits, outside the action that started the load, and a volatile write there has to go through an action of its own. |
| <span id="action-setrefnamemismatch">**setRefNameMismatch**</span><br><code>(adapterCacheKey: string, mismatch: RefNameMismatch) =&gt; void</code> | Record that an adapter's reference names and this assembly's have nothing in common. Diagnostic only: `loadRefNameMap` still returns its map and the track still loads, because a wrong guess here must not take a working track away from anyone. |
| <span id="action-setloaded">**setLoaded**</span><br><span class="cell-more"><button type="button" class="cell-more-trigger"><code>({…}: RefNameMaps &amp; { regions: Region[]; cytobands: Feature[];…</code></button><dialog class="cell-dialog"><form method="dialog"><button class="cell-dialog-close" aria-label="Close">✕</button></form><pre><code>({…}: RefNameMaps &amp; { regions: Region[]; cytobands: Feature[]; geneticCodes: Record&lt;…&gt;; }) =&gt; void</code></pre></dialog></span> | Applies all load-time state in a single transaction so dependent autoruns fire once, with the precomputed lowercase/name lookups already in place by the time refNameAliases becomes observable. |
| <span id="action-seterror">**setError**</span><br><code>(e: unknown) =&gt; void</code> |  |
| <span id="action-setloadingp">**setLoadingP**</span><br><code>(p?: Promise&lt;void&gt; &#124; undefined) =&gt; void</code> |  |
| <span id="action-loadpre">**loadPre**</span><br><code>() =&gt; Promise&lt;void&gt;</code> |  |
| <span id="action-load">**load**</span><br><code>() =&gt; Promise&lt;void&gt;</code> | Resolves once regions + refNameAliases are set, and rejects with the load failure. Idempotent: concurrent callers share one attempt, and a failed attempt is discarded so the next call retries.<br><br>The rejection is the authoritative signal for a caller that awaits it. `self.error` mirrors it for reactive consumers only (the UI renders it), and must not be consulted after an await: a concurrent retry clears it, so an awaiter reading it can see a cleared error and mistake a failed load for a successful one. |
