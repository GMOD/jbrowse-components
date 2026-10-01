---
name: refname-namespaces
description: Why `refName` means two different things either side of the RPC boundary, which side may canonicalize, the same defect in assembly names, and the sequence adapter the rename derives. Read before comparing a fetched refName or adding an RPC that returns one.
kind: spec
---

# The two refName namespaces

`renameRegionsIfNeeded` rewrites a request's `regions[]` into the **adapter's**
naming scheme inside `serializeArguments`. So `refName` means the assembly's
canonical name before the RPC boundary and the file's name after it, in the same
field of the same type. `util/renameRegions.ts` states this in its header.

The rename is **one-way**: nothing in the RPC layer renames a result on the way
back. Each plugin that needs the return direction has built its own.

## The rule: is the answer about a region you asked for?

A one-way rename suffices exactly while an RPC's answer describes the regions
the caller requested. An ordinary LGV display never notices the split: every
feature that comes back is on the requested block, and rendering positions
features by `start`/`end` alone, so the refName rides along unread.

It breaks when an answer names a location the caller did **not** request: a
mate, a breakend, an arc partner, a synteny target, an index SNP. That refName
arrives in the file's spelling, and everything on the main thread it meets
(`dynamicBlocks`, `displayedRegions`, `assembly.refNames`) is canonical.

Feature-to-feature comparisons are safe because both operands come from one
fetch (`features/arcs/compute.ts` comparing `a.refName !== b.refName`). Only
feature-against-view-state straddles.

## Main-thread normalization

Any reading of user-supplied refName text resolves through
`getCanonicalRefName2`, which handles aliases and casing. Testing
`region.refName` directly gets neither, and the failure looks like "this
assembly has no such contigs".

`getCanonicalRefName2` is total: an unknown name, or one asked for before the
aliases load, comes back unchanged. The strict `getCanonicalRefName` returns
`undefined` for the first and THROWS for the second. Use the strict one only
where the caller acts on "no such name" and cannot run pre-load, meaning after
`waitForAssembly` or off a list the assembly produced. Hand-rolling
`getCanonicalRefName(x) ?? x` looks total and does nothing about the throw.

For matching refName text:

- Match over `allRefNames`, not `regions`; it is a strict superset of the
  canonical names.
- Resolve hits to canonical, then emit by walking `regions`, which keeps
  assembly order and dedupes several names for one contig.
- Case-insensitivity is the regex's `i` flag, not a wider list.

`selectNamedRegions.ts` holds the only two readings of `*`; `globToRegExp` stays
module-private to keep it that way.

A display reading a refName out of its own state calls
`canonicalizeViewRefName` (`@jbrowse/core/util`). A menu copy or search result is
canonical by construction; a **session spec, config slot or URL** is whatever a
person typed. It resolves through `getCanonicalRefName2`, so a spec read before
the aliases load falls back to the input. Normalize once where the state is
read, not at each comparison. The result is assembly-dependent: `chr12` matches
nothing on an assembly canonicalized `12`.

**None of this applies worker-side.** Canonicalizing an operand compared in the
worker breaks exactly the aliased tracks the rule exists for. Check which side a
comparison runs on; alignments layout looks worker-side and is not (ADR-053).

## The reference is part of the adapter's identity

BAM/CRAM decode against the reference, and GC content and the reference scans
compute from it, but a track's adapter config does not carry the reference; the
assembly does. The assembly's sequence adapter config rides **alongside**
`adapterConfig` as a sibling RPC arg, never spliced into it. `dataAdapterCache`
keys any type declaring `READS_REFERENCE` on its config AND that sequence, and
hands the sequence to the constructor. One BAM shown on two genomes is two
instances; two assemblies over one FASTA, or an alias spelling, hash to one.
`CramAdapter` binds its `seqFetch` into `IndexedCramFile` at construction, which
is why the reference is instance state rather than a per-call argument.

**No caller passes it.** A call names its genome in one field, `assemblyName`,
and `RpcMethodType.serializeArguments` turns that name into the sequence adapter
config, ahead of the location walk that converts file handles and adds auth.
Per-genome renaming methods (`RpcMethodTypeWithRenameRegions` and its variants)
get `assemblyName` from their regions; header calls (`CoreGetRefNames`,
`CoreGetInfo`) name their own. The reference is a property of the call, like
`sessionId`; `RpcRegistry` documents why.

A comparative request (synteny, dotplot, chords) renames a region per assembly
and names no genome: `renameComparativeRegions`, reached through synteny-core's
`renameRegionsForAdapter` on the main thread before the RPC. Synteny adapters
read no reference, so nothing rides on those calls. The chord display, which
fetches through `CoreGetFeatures`, sends one request per assembly.

An instance built for a request that named no genome answers header and metadata
calls, and throws on its first reference read, naming the adapter type.
`data_adapters/adapterReference.test.ts` pins the per-genome construction and
`pluggableElementTypes/attachReference.test.ts` the derivation.

## Plugin workarounds

| plugin | the un-requested refName | what it does about it |
| --- | --- | --- |
| alignments | mate / `next_ref` | `getCanonicalRefName2` on receipt, through `clampToContig` / `clampToListedContig` (`viewMateRegion.ts`) |
| breakpoint-split | overlay / translocation partners | `getCanonicalRefName2` on receipt (`BreakpointSplitView/model.ts`) |
| gwas | `indexSnp` | `canonicalizeViewRefName` (`ldJoinResolver.ts`) |
| hic | the view's pre-rename refNames | carried beside the regions in `axisBlocks[].refName` |
| `GetConsensusSequence` | none | returns no refName |
| synteny | the entire mate axis | `getCanonicalRefNameFn` on receipt, on both channels |

A new plugin that receives an out-of-request refName should **resolve on receipt
through the assembly's alias table**, not invert the outbound map. The outbound
map is keyed by canonical name, so inverting it keeps one file spelling per
contig and is not total.

## Synteny

For other plugins the un-requested refName is an occasional extra. For synteny it
is the payload: every feature names a contig on the other axis. So the fix sits
at the two channels that carry names off the wire, not at each reader, and both
are renamed on receipt:

- `SyntenyFeatureData`'s `refNameDict` / `mateRefNameDict`, through
  `canonicalizeSyntenyDictLanes` (`synteny-core/src/renameDictLane.ts`, lanes in
  `syntenyLaneSchema.ts`), called from the fetch in
  `LinearSyntenyDisplay/afterAttach`. The dictionaries stay adapter-space out of
  the worker because the worker has no assemblyManager; reconciliation happens
  on the main thread before the call (`renameRegionsForAdapter`).
- `ResolvedSpan.refName` from `SyntenyResolveMatchingRegion`, canonicalized in
  `resolveMatchingSpan`.

**Keep them canonicalized together.** Doing only the first is worse than neither:
`alreadyShowing` then compares canonical against adapter-space, never matches,
and renavigates on every wake, breaking the one-RPC-per-settle invariant
`LinearSyntenyFollow.test.tsx` pins.

`getCanonicalRefNameFn` (`@jbrowse/synteny-core`) is built **per axis**: the
query assembly for the `refName` lane, the target for the `mate` lane, so two
contigs spelled alike on the two assemblies cannot collide. It reads the alias
table. `getAdapterToCanonicalRefNameMap` is for a worker with no assembly to ask;
against a live assembly it is less total, for the one-spelling reason above.

Name the axes by `assemblyNames[0]` captured before the RPC, not derived from
`displayedRegions` after it: those are MST nodes, and a comparative fetch can
outlive the level that started it, so reading one throws into an unawaited
promise.

**Re-intern after renaming.** The worker interned the dictionaries in adapter
space, so entries are distinct. Renaming can collapse two onto one canonical
name: a file spelling a contig `chr1` on some rows and `1` on others, against an
assembly canonicalizing `1`, arrives as two entries and leaves as one.
Duplicates break readers that resolve a name to an id once and compare integers
(`pickFollowFeature`, `followWindowMapping`, via `dict.indexOf`): `indexOf` finds
the first duplicate and every feature carrying the second id silently stops
matching. `renameDictLane` does the re-intern, which is why it is not an
in-place `.map()`. The per-feature id array returns untouched unless a collapse
happened.

Such a file is also half-broken going OUT: the requested region renames through
`loadRefNameMap`, which keeps one spelling per contig, so rows under the other
spelling are never fetched. Nothing in synteny can close that.

**Audit method for a new reader.** Grep the readers of the two channels
(`getFeatureAtIndex` / `getFeature` for the dictionaries, `ResolvedSpan` for the
spans), then name each hit's two operands. A site straddles only when one
operand comes from a feature and the other from view state.

**A site can be safe because it leaves again.** `moveMatchingPanel` puts
`feat.refName` into `SyntenyResolveMatchingRegion`'s `regions[]`. The outbound
rename keys on canonical names, so an adapter-only spelling misses and passes
through unchanged, and a canonical one maps to the adapter name. Do not
special-case it and do not canonicalize it twice. `navToResolvedSpan` is safe
for a different reason: `navToLocString` resolves aliases itself through
`asm.getCanonicalRefName`.

### A straddle whose symptom is a wrong palette

Chromosome painting looked each feature's refName up in the assembly's canonical
refName list. On an aliased file every lookup missed and fell through to the
hash palette, which is collision-prone. That fallback is also legitimate while
an assembly loads, so nothing read as wrong. `Assembly.getRefNamePosition` now
canonicalizes its argument itself, so synteny and the dotplot (whose dictionary
stays adapter-space) both land. A straddle whose failure mode is a legitimate
state survives audits.

### The dotplot needs none of this

Its one main-thread reader of the adapter-space dictionaries,
`computeDotplotColors`, goes through `getRefNamePosition`. The rest is
adapter-space on both sides on purpose (`hIndex`/`vIndex` built from regions
`afterAttach` renamed; `skippedHRefNames`; `hasUnknownRefNames`). The hover
tooltip reads canonical names off the axis regions through `pxToBp`
(`dotplotTooltip.ts`), not off the dictionary.

## Assembly names are a third namespace

`mateAssemblyNameDict` carries the adapter's `assemblyNames[]` verbatim, which is
config text. `pickFollowFeature` and `followWindowMapping` look up a view's
`assemblyNames[0]` in it, and `centerOnFeature` compares directly; the view's
names are canonical. A synteny track naming its second assembly by an alias is
still offered (`syntenyTrackRows` resolves through `canonicalAssemblyNames`), so
the track loads and ribbons draw, but the id lookup returns -1, every candidate
drops and the follow reports the window unaligned.

Only the mate lane is canonicalized. `assemblyNameDict` goes back OUT as
`SyntenyResolveMatchingRegion`'s `regions[]` assembly, safe for the same reason
as `feat.refName`. Outbound, `renameRegionsForAdapter` respells every region's
`assemblyName` into the adapter's `assemblyNames` through
`regionsInAssemblyNamespace`, and a region that still reaches a pairwise
adapter's `getFeatures` unrespelled throws `AssemblyNotInAdapterError` rather
than drawing an empty band.

## Test fixtures

The defect shows only when a file spells a contig with an **alias** of the
assembly's name, which needs mixed provenance (a minimap2 PAF over NCBI or
Ensembl downloads against a UCSC assembly). Every shipped config pairs a FASTA
and alignment from one provider.

`products/jbrowse-web/src/tests/LinearSyntenyRefNameAlias.test.tsx` holds the
fixtures. `volvox_alias_target.paf` tells the two axes' resolvers apart:
volvox_del declares no aliases, so on the query-axis fixtures the target
resolver is identity and a single shared resolver, or no mate rename at all,
passes every assertion. The transposed alignment puts `A` in `mateRefNameDict`,
and it carries **no CIGAR** on purpose: with one, channel 2 canonicalizes the
answer whatever the dictionary holds. It asserts on the dictionaries because
`navToLocString` would hide the difference. `volvox_asmalias.paf` covers the
assembly-name lane with every refName canonical.

`detectRefNameMismatch` never reports this: it returns `undefined` once a file
name resolves through the aliases, and warns only when aliases are missing.

## Branding catches most straddles, only if both ends are branded

`type AdapterRefName = string & { readonly __ns: 'adapter' }` is compile-time
only. Comparing two brands is TS2367, `Map<Canonical,_>.get(adapterName)` is
TS2345, and `Record<Canonical,_>[adapterName]` is TS7053. A branded value still
flows into any `(s: string)` parameter.

**The trap:** `plain === branded` does not error, because `string` and
`string & {…}` overlap. Both ends must be branded, and the brand cannot catch a
site that hands the name to a core function taking a plain `string`
(`positionViewOnSpan` → `bpToOffset`). Brand out-of-request refNames (mate,
partner, target), not refName generally.
