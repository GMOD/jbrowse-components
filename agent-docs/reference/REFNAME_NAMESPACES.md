---
name: refname-namespaces
description: Why `refName` means two different things either side of the RPC boundary, the one-sentence rule that says when that is safe (an answer about a region you asked for) and when it is not (an answer naming a location you did not), the six plugins that hit it and the five different workarounds they each invented, and why synteny is the one that never got one. Read before comparing a fetched refName against anything, or before adding an RPC that returns a refName.
---

# The two refName namespaces

`renameRegionsIfNeeded` rewrites a request's `regions[]` into the **adapter's**
naming scheme inside `serializeArguments`, so `refName` means the assembly's
canonical name before the RPC boundary and the file's name after it — in the
same field of the same type. `util/renameRegions.ts` is the statement of this
and its header says it out loud.

The rename is **one-way**. Nothing renames a result on the way back.

## The rule: is the answer about a region you asked for?

A one-way rename is sufficient exactly while an RPC's answer describes the
regions the caller requested. That is why an ordinary LGV display never notices
the split: it asked for a block, every feature that comes back is on that block
by construction, and rendering positions features by `start`/`end` alone. The
refName rides along **unread**, so a wrong spelling is invisible.

It breaks the moment an answer names a location the caller did **not** request —
a mate, a breakend, an arc partner, a synteny target, an index SNP. That refName
is new information, it arrives in the file's spelling, and every main-thread
thing it meets (`dynamicBlocks`, `displayedRegions`, `assembly.refNames`) is
canonical.

Feature-to-feature comparisons are safe for the same reason: both operands come
from the same fetch, so they agree. `features/derivativePaths/computePaths.ts`
and `features/arcs/compute.ts` compare `a.refName !== b.refName` and are
correct. Only feature-against-view-state straddles.

## Six plugins hit it; five invented a different fix

| plugin | the un-requested refName | what it does about it |
| --- | --- | --- |
| alignments | mate / `next_ref` | `getCanonicalRefName2` on receipt (`viewMateRegion.ts`) |
| breakpoint-split | overlay / translocation partners | `getCanonicalRefName` on receipt (`BreakpointSplitView/model.ts`) |
| gwas | `indexSnp` | bundled into `regions` so it rides the inbound pass |
| hic | `viewBlocks[].refName` | the view's own names carried in a parallel array |
| `GetConsensusSequence` | — | returns no refName at all |
| **synteny** | **the entire mate axis** | **nothing** |

Five ad-hoc solutions to one missing primitive is the cost already paid for not
having a return-direction rename.

## Why synteny is the worst case rather than a special case

For every other plugin the un-requested refName is an occasional extra — one
field, one place to remember. For synteny it *is* the payload: every feature
names a contig on the other axis, because that is what a synteny feature is. So
where alignments has one cross-boundary read to get right, synteny has one per
reader, and the readers grew without anyone noticing the class.

Two channels carry adapter-space names into synteny's main thread:

- `SyntenyFeatureData.refNames` / `mateRefNames`, from the fetch. The worker
  comment at the head of `executeSyntenyFeaturesAndPositions.ts` says why they
  are adapter-space: the RPC worker has no assemblyManager, so reconciliation
  happens on the main thread *before* the call
  (`renameRegionsForAdapter`), and the features are handed back unmodified.
- `ResolvedSpan.refName`, from `SyntenyResolveMatchingRegion`. Read off the
  feature in `resolveAlignmentSpan.ts`.

Both have to be canonicalized together. Doing only the first is worse than
doing neither: `alreadyShowing` would compare canonical against adapter-space,
never match, and renavigate on every wake — breaking the one-RPC-per-settle
invariant `LinearSyntenyFollow.test.tsx` pins.

`getAdapterToCanonicalRefNameMap` (`@jbrowse/synteny-core`) is the inverse map
for both, and already exists because the diagonalize RPCs needed exactly this.

## When it is observable

Only when a file spells a contig with a name the assembly knows as an **alias**.
The map `loadRefNameMap` builds is `result[getCanonicalRefName(fileName)] =
fileName`, so it is identity whenever the file and the assembly agree — which is
every config we ship, because their FASTA and their alignment file come from the
same provider. Mixed provenance is the trigger: a minimap2 PAF over NCBI or
Ensembl downloads against a UCSC assembly.

`products/jbrowse-web/src/tests/LinearSyntenyRefNameAlias.test.tsx` is the
fixture — two PAFs describing one alignment, differing only in whether the query
contig is spelled `ctgA` or `A`, which `test_data/volvox/config.json` already
declared as an alias. Both load and draw; only the canonically-spelled one
follows.

## Nothing catches it, by construction

`detectRefNameMismatch` returns `undefined` the instant one file name resolves
through the aliases to an assembly refName. It fires when aliases are **missing**
— loudly, with `TrackLabelRefNameWarning` — and is deliberately blind when they
are present and working, which is this case. That is correct behaviour for what
it is for, and it means it will never report this.

## The repo-wide half nobody notices

A refName used as **display text** is wrong everywhere, not just in synteny: a
feature detail panel or tooltip on any aliased file shows the file's spelling
rather than the assembly's. It is cosmetic, universally unnoticed, and the same
defect. Worth knowing before describing this as a synteny bug.

## Branding catches most of it, and only if both ends are branded

`type AdapterRefName = string & { readonly __ns: 'adapter' }` is compile-time
only — the property never exists, values stay plain strings, nothing changes
over the wire. Verified against TS7 `--strict`: comparing two brands is
**TS2367**, `Map<Canonical,_>.get(adapterName)` is TS2345, and
`Record<Canonical,_>[adapterName]` is TS7053 — which are exactly the shapes the
six broken sites take. A branded value still flows into any `(s: string)`
parameter, so it is not viral downward.

**The trap:** `plain === branded` does **not** error, because `string` and
`string & {…}` overlap. Branding one end buys nothing; both ends have to be
branded for the comparison to fail. That also means it cannot catch a site that
hands the name to a core function taking a plain `string` — `positionViewOnSpan`
→ `bpToOffset` is the known one.

The brand belongs specifically on **out-of-request** refNames — mate, partner,
target — not on refName generally. That is a far smaller surface and it means
something a reader can act on.
