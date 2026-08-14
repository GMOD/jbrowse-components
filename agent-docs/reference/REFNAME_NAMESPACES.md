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

- `SyntenyFeatureData`'s `refNameDict` / `mateRefNameDict`, from the fetch —
  dictionary-encoded since the payload optimization below, so these are the
  DICTIONARIES the per-feature `refNameIds` / `mateRefNameIds` index. The worker
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

### The first channel is now a dictionary, which changes the fix twice

Cheaper, and with one new requirement.

**Cheaper:** the rename is a pass over a few dozen dictionary entries, once per
fetch, not over a string per feature. The "skip the walk when the map is empty"
guard the plan carried was there to keep a per-feature pass off the common path;
against a dictionary the walk is negligible either way, so the guard is optional
rather than load-bearing.

**New requirement: RE-INTERN after renaming.** The dictionary's entries are
distinct by construction while they are adapter-space, because the worker
interned them. Renaming can collapse two of them onto one canonical name — a file
that spells the same contig `chr1` on some rows and `1` on others, against an
assembly aliasing both, which is precisely the mixed-provenance case this whole
class is about. Duplicate entries break the readers that resolve a name to an id
ONCE and then compare integers (`pickFollowFeature`, `followWindowMapping`, both
via `dict.indexOf`): `indexOf` finds the first of the duplicates, and every
feature carrying the second id silently stops matching. So the rename is
`makeStringDict` again over the renamed values, remapping the ids — not a
`.map()` in place.

### One straddle whose symptom is a wrong palette, not a missed match

Worth calling out separately because it does not look like the others. Chromosome
painting takes `nameOrder` — `paintedChromosomeOrder`, which is
`assemblyManager.get(name)?.refNames`, so **canonical** — and looks each feature's
refName up in it (`orderOf.get(name)` in `syntenyColors.nameColorFunction`).
Adapter-space against canonical, one operand from each side.

On an aliased file every lookup misses and the function falls through to its hash
fallback, which is the collision-prone palette `nameOrder` was added to replace:
nine slots for twelve chromosomes, "some unexpected color re-use" as a figure
review put it. So the failure is not nothing-happens, it is a figure that is
quietly painted with the palette that was rejected — and the fallback is a
legitimate state for other reasons (an assembly still loading), so nothing about
it reads as wrong.

Now confined to a dictionary walk rather than a per-feature one, so
canonicalizing the dictionary fixes this site for free along with the rest.

## Every synteny site, and what each one needs

The audit result, filed rather than described — an earlier version of this thread
reported a reader count and left the list in the session, so the next reader had
to redo it.

**Method, so it can be re-run rather than trusted:** grep the two channels'
readers (`getFeatureAtIndex` / `getFeature` for the first, `ResolvedSpan` for the
second), then read each hit and name its *two* operands. A site is a straddle only
if one operand comes from a feature and the other from view state — that is the
rule at the top of this file, applied one site at a time.

Channel 1, `refNameDict` / `mateRefNameDict` reached through `getFeatureAtIndex`:

| site | the other operand | class | symptom on an aliased file |
| --- | --- | --- | --- |
| `components/util.ts` `getTooltip` | none, it is printed | display text | the tooltip shows the file's spelling |
| `LevelSyntenyCanvas` `openSyntenyFeatureWidget` | none, into the widget | display text | the feature panel shows the file's spelling |
| `bandMoveTargets.ts` → `visibleSpanOnRefName` | `dynamicBlocks` | **straddle** | the band's "Move … to the matching region" item is not offered at all |
| `moveMatchingPanel.ts` RPC `regions[]` | — it goes back OUT | safe — see below | none |
| `pickFollowFeature.ts` | `window.refName` | **straddle** | the follow reports the window unaligned (the fixture) |
| `followWindowMapping.ts` | `window.refName`, and the mate assembly | **straddle** | as above |
| `planFollowStep.ts` `windowInsideFeat` | `window.refName` | **straddle** | as above |
| `interpolateFollowSpan.ts` | — it EMITS one | **straddle producer** | hands an adapter name to the channel-2 consumers with no RPC in between |
| `syntenyColors.nameColorFunction` | `nameOrder`, canonical | **straddle** | the chromosome palette degrades to the hash — see above |

Channel 2, `ResolvedSpan.refName`:

| site | the other operand | class |
| --- | --- | --- |
| `alreadyShowing.ts` | the moving view's current region | **straddle** — the one that makes a channel-1-only fix worse than none |
| `moveMatchingPanel.ts` `navToResolvedSpan` | `navToLocString`'s parser | **straddle** |
| `positionViewOnSpan.ts` | `bpToOffset`, core, plain `string` | **straddle, and the site branding cannot catch** |
| `followTransform.ts` | its own `refName` is the window's | carrier — `targetRefName` is the span's and flows out through `applyFollowTransform` |

Thirteen sites; nine straddle. The count differs from the "eleven" this thread
first reported because carriers and producers can be counted either way — which is
the reason to keep the table rather than the number.

### The one that goes back OUT is safe, and safe after the fix too

`moveMatchingPanel` puts `feat.refName` into `SyntenyResolveMatchingRegion`'s
`regions[]`. That looks like a straddle and is not, in either direction, and it is
worth knowing precisely because it can be "fixed" wrongly from both sides:

- **Today** it works by accident. The method extends
  `RpcMethodTypeWithRenameRegions`, so the outbound pass renames `regions[]`
  canonical→adapter through a map keyed by *canonical* names. An
  adapter-only spelling is not a key, misses, and passes through unchanged — which
  is the spelling the worker wanted.
- **After canonicalizing channel 1** it works by design: the name going in is
  canonical, the outbound rename maps it, the worker gets the same string.

So do not special-case this site and do not canonicalize it twice. The one input
that breaks it is a file spelling a contig with a name that is *also* the
canonical name of a different contig, where the pass-through miss becomes a wrong
hit — pathological, and it is broken today for the same reason.

## Potential solutions, in the order they can be taken

1. **Canonicalize both channels** (the filed plan — `TODO.md` §*Canonicalize the
   two synteny refName channels*). Fixes all nine straddles and both display-text
   sites at once, because everything above reads through `getFeatureAtIndex` or
   `ResolvedSpan`. First step is the smallest one that cannot go wrong: rename the
   two dictionaries in `afterAttach`'s `run`, re-intern (above), and rename
   `ResolvedSpan.refName` in `resolveMatchingSpan` — in the **same commit**, since
   either alone regresses. `LinearSyntenyRefNameAlias.test.tsx`'s `test.failing`
   is the gate, and `LinearSyntenyFollow.test.tsx`'s RPC count is the guard
   against the half-done version.
2. **Brand the out-of-request names** so a fourteenth site cannot appear quietly.
   Independent of 1 and worth doing after it, not before: branding a fixed tree is
   a type-only change, branding a broken one buys an error list to wade through.
   Both ends have to be branded (the trap below), and `positionViewOnSpan` is
   known to be out of reach.
3. **A return-direction rename at the RPC layer, declared per method.** The
   fourth-time-lucky version: it would collapse all five existing workarounds in
   the table above into one mechanism, and synteny would need no per-site work at
   all. Much larger, and it wants a design pass rather than a patch — but it is
   the only option that stops the sixth plugin becoming a seventh.
4. **Do the display-text half separately, per view.** Cheapest of all and
   independent of every other option: resolve the name off the view's own regions
   at the point of display rather than reading the feature's. The dotplot tooltip
   is the worked example (~10 lines, `pxToBp`, no rename anywhere). This is the
   whole of decision 3 in the handoff, and its cost is now measured rather than
   guessed.

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

## The dotplot fetch: same shape, no straddle

Audited by enumerating the readers, since it is the same payload shape and was
listed as unexamined. It has **one** main-thread reader of its adapter-space
`refNameDict` / `mateRefNameDict`: `dotplotColors.nameColorFn`, which hashes the
name to a color and takes no `nameOrder`, so there is nothing canonical for it to
disagree with. Cosmetically the color a contig gets depends on the file's spelling
of its name; nothing is compared, nothing is missed.

Everything else on that path is adapter-space on both sides on purpose:

- the worker's `hIndex`/`vIndex` are built from `hViewSnap`/`vViewSnap` regions
  that `afterAttach` renamed before the call, so `entries.has(refName)` matches
  like against like;
- `skippedHRefNames` comes back adapter-space and `hasUnknownRefNames` renames
  the assembly's own regions INTO adapter space before comparing, with a comment
  saying why;
- the hover tooltip deliberately does **not** read the dictionary. It resolves
  both axes through `pxToBp`, i.e. off the view's regions, so it prints canonical
  names (`dotplotTooltip.ts` says so at the top). That is the display-text half
  below, solved in one view for ~10 lines and with no rename — which is the
  cheapest evidence available on whether that case is worth opening.

So the dotplot needs no part of the synteny fix. It is not that it was overlooked;
its answers are about regions it asked for, which is the rule at the top of this
file.

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
