---
name: refname-namespaces
description: Why `refName` means two different things either side of the RPC boundary, which side may canonicalize, and the sequence adapter the rename derives. Read before comparing a fetched refName or adding an RPC that returns one.
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

A one-way rename suffices exactly while an RPC's answer describes the regions the
caller requested. It breaks when an answer names a location the caller did **not**
request: a mate, a breakend, an arc partner, a synteny target, an index SNP. That
refName arrives in the file's spelling, and everything on the main thread it
meets (`dynamicBlocks`, `displayedRegions`, `assembly.refNames`) is canonical.
Feature-to-feature comparisons are safe because both operands come from one
fetch; only feature-against-view-state straddles.

## Main-thread normalization

Any reading of user-supplied refName text resolves through
`getCanonicalRefName2`, which handles aliases and casing. Testing
`region.refName` directly gets neither, and the failure looks like "this
assembly has no such contigs".

`getCanonicalRefName2` is total: an unknown name, or one asked for before the
aliases load, comes back unchanged. The strict `getCanonicalRefName` returns
`undefined` for the first and THROWS for the second. Use the strict one only
where the caller acts on "no such name" and cannot run pre-load. Hand-rolling
`getCanonicalRefName(x) ?? x` looks total and does nothing about the throw.

## The reference is part of the adapter's identity

BAM/CRAM decode against the reference, and GC content and the reference scans
compute from it, but a track's adapter config does not carry the reference; the
assembly does. The assembly's sequence adapter config rides **alongside**
`adapterConfig` as a sibling RPC arg, never spliced into it. `dataAdapterCache`
keys any type declaring `READS_REFERENCE` on its config AND that sequence, and
hands the sequence to the constructor. One BAM shown on two genomes is two
instances; two assemblies over one FASTA, or an alias spelling, hash to one.

## Plugin workarounds

A new plugin that receives an out-of-request refName should **resolve on receipt
through the assembly's alias table**, not invert the outbound map. The outbound
map is keyed by canonical name, so inverting it keeps one file spelling per
contig and is not total.

## Synteny

For synteny the un-requested refName is the payload: every feature names a contig
on the other axis. So the fix sits at the two channels that carry names off the
wire, and both are renamed on receipt:

- `SyntenyFeatureData`'s `refNameDict` / `mateRefNameDict`, through
  `canonicalizeSyntenyDictLanes` (`synteny-core/src/renameDictLane.ts`), called
  from the fetch in `LinearSyntenyDisplay/afterAttach`. The dictionaries stay
  adapter-space out of the worker because the worker has no assemblyManager.
- `ResolvedSpan.refName` from `SyntenyResolveMatchingRegion`, canonicalized in
  `resolveMatchingSpan`.

**Keep them canonicalized together.** Doing only the first is worse than neither:
`alreadyShowing` then compares canonical against adapter-space, never matches,
and renavigates on every wake, breaking the one-RPC-per-settle invariant
`LinearSyntenyFollow.test.tsx` pins.

**Re-intern after renaming.** Renaming can collapse two dictionary entries onto
one canonical name (a file spelling a contig `chr1` on some rows and `1` on
others). Duplicates break readers that resolve a name to an id once and compare
integers (`pickFollowFeature`, `followWindowMapping`, via `dict.indexOf`): every
feature carrying the second id silently stops matching. `renameDictLane` does the
re-intern, which is why it is not an in-place `.map()`. Such a file is also
half-broken going OUT: `loadRefNameMap` keeps one spelling per contig, so rows
under the other spelling are never fetched. Nothing in synteny can close that.

## Branding catches most straddles, only if both ends are branded

`type AdapterRefName = string & { readonly __ns: 'adapter' }` is compile-time
only. Comparing two brands is TS2367, `Map<Canonical,_>.get(adapterName)` is
TS2345.

**The trap:** `plain === branded` does not error, because `string` and
`string & {…}` overlap. Both ends must be branded, and the brand cannot catch a
site that hands the name to a core function taking a plain `string`
(`positionViewOnSpan` → `bpToOffset`). Brand out-of-request refNames (mate,
partner, target), not refName generally.
