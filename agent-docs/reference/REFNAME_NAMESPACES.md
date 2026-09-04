---
name: refname-namespaces
description: Why `refName` means two different things either side of the RPC boundary, the one-sentence rule that says when that is safe (an answer about a region you asked for) and when it is not (an answer naming a location you did not), and the six plugins that hit it and invented six different workarounds — including synteny's, which is two renames covering thirteen readers and where the per-site audit table now lives. Also the same defect in ASSEMBLY names one field over, and the other thing the rename derives for free: the sequence adapter config a BAM/CRAM decodes against. Read before comparing a fetched refName against anything, or before adding an RPC that returns a refName or decodes against the reference.
---

# The two refName namespaces

`renameRegionsIfNeeded` rewrites a request's `regions[]` into the **adapter's**
naming scheme inside `serializeArguments`, so `refName` means the assembly's
canonical name before the RPC boundary and the file's name after it — in the
same field of the same type. `util/renameRegions.ts` is the statement of this
and its header says it out loud.

The rename is **one-way**: nothing in the RPC layer renames a result on the way
back. Every plugin that needs the return direction has built its own, six times
over — see the table below, which is the argument for the layer-level version
rather than a description of a solved problem.

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

## The main-thread normalization layer

Everything above is about the boundary. On the main thread the rule is that
**any reading of user-supplied refName text resolves through
`getCanonicalRefName2`**, which handles aliases *and* casing; testing
`region.refName` directly gets neither, and the failure is indistinguishable
from "this assembly has no such contigs".

`getCanonicalRefName2` is the total one and the default: an unknown name comes
back unchanged, and so does one asked for before the aliases load, where the
strict `getCanonicalRefName` answers `undefined` for the first and THROWS for
the second. Reach for the strict one only where the caller genuinely acts on
"this assembly has no such name" — and only where it cannot run pre-load, which
in practice means after `waitForAssembly` or off a list the assembly itself
produced. Hand-rolling `getCanonicalRefName(x) ?? x` is the trap: it looks total
and does nothing about the throw.

For anything matching refName text:

- **Match over `allRefNames`, not `regions`** — it is a strict superset of the
  canonical names.
- **Resolve hits to canonical, then emit by walking `regions`**, which keeps
  assembly order and dedupes several names for one contig.
- **Case-insensitivity is the regex's `i` flag, not a wider list.**

`selectNamedRegions.ts` holds the only two readings of `*`, and `globToRegExp`
is module-private to keep it that way.

**A display reading a refName out of its own state calls
`canonicalizeViewRefName`** (`@jbrowse/core/util`). A menu copy and a search
result are canonical by construction; a **session spec, config slot or URL** is
whatever a person typed. It resolves through `getCanonicalRefName2`, so a spec
read before the aliases load falls back to the input rather than throwing —
these getters run from the first render. Normalize once where the state is
read, not at each comparison.

It is assembly-dependent: `chr12` matches nothing on an assembly canonicalized
`12`, so a spec key works in the config it was written against and quietly does
nothing in the next.

**None of this applies worker-side** — that is the whole point of the boundary
above, and canonicalizing an operand compared in the worker breaks exactly the
aliased tracks the rule exists for. Check which side a comparison runs on;
alignments layout looks worker-side and is not (ADR-053).

## The rename also carries the sequence adapter, and that is why it is derived

BAM/CRAM decode against the reference (CRAM to reconstruct bases, BAM to compute
mismatches without an MD tag), but a track's adapter config doesn't carry the
reference — it belongs to the assembly. So the assembly's sequence adapter config
rides **alongside** `adapterConfig` as a sibling RPC arg, never spliced into it,
and is stashed on the resolved adapter instance by `setSequenceAdapterConfig`;
the adapter lazily builds it through `getSubAdapter` on first
`getSequenceAdapter()`. `CramAdapter` binds its `seqFetch` into the
`IndexedCramFile` at construction, which is why the config lives on the instance
rather than travelling per call.

**No caller passes it.** `renameRegionsIfNeeded` already resolves the assembly a
fetch is against — the same handle `originalRefName` is a name into — so it
supplies the config, and every renaming RPC gets one for free. That makes it a
property of the *call* rather than of any method's payload, like `sessionId` and
the handles; `RpcRegistry` documents why that distinction is worth keeping.

It was a rule until 2026-08-19, and the rule did not hold: `CoreGetExportData`,
`BreakpointGetFeatures` and `fetchTrackData`'s `CoreGetFeatures` all omitted it
and worked only because `CoreGetRefNames` had primed the instance first.
Forgetting was silent — a CRAM throws mid-decode, a BAM just reports no
mismatches — so deriving it beats documenting it.

`CoreGetRefNames` is the one exception and still passes its own, because it is
what renaming CALLS and cannot be fed by it. Its priming is not vestigial: a
`ReferenceScanAdapter` resolves its sequence *inside its own `getRefNames`*, so
that call must arrive already primed. What no longer holds is any LATER call
depending on it — delete the priming outright and `SaveTrackData`'s CRAM case
stays green, where it used to be the only test in the repo that saw it.

Two tests hold this down. `data_adapters/sequenceAdapterPriming.test.ts` pins
the priming contract directly — prime through `CoreGetRefNames`, fetch with
nothing, read the reference back — and the alignments adapters' own suites (20
tests over 10 files) pin the consumer half, that an adapter uses the config it
was handed.

`setSequenceAdapterConfig` is set-once: one `??=`, which both refuses to clear
the field and refuses to replace it. A multi-assembly fetch can therefore prime
one instance twice with two different configs, and the first wins. That is
harmless rather than fixed — the adapters fetched across two assemblies are the
comparative ones, which never read the field. Both the compound cache key and a
loud conflict were costed and declined; see
[REJECTED_IDEAS.md](REJECTED_IDEAS.md).

## Six plugins hit it; six invented a different fix

| plugin | the un-requested refName | what it does about it |
| --- | --- | --- |
| alignments | mate / `next_ref` | `getCanonicalRefName2` on receipt (`viewMateRegion.ts`) |
| breakpoint-split | overlay / translocation partners | `getCanonicalRefName2` on receipt (`BreakpointSplitView/model.ts`) |
| gwas | `indexSnp` | bundled into `regions` so it rides the inbound pass |
| hic | `viewBlocks[].refName` | the view's own names carried in a parallel array |
| `GetConsensusSequence` | — | returns no refName at all |
| synteny | the entire mate axis | `getCanonicalRefNameFn` on receipt, on both channels (below) |

**Six ad-hoc solutions to one missing primitive** is the cost already paid for
not having a return-direction rename, and synteny joining the list is the reason
that number is now the argument rather than the fix being the argument. Each
plugin's workaround is correct and none of them is reusable by the next one; the
seventh will invent a seventh.

Three of the six now reach for the same primitive — alignments and
breakpoint-split calling `getCanonicalRefName2`, synteny's
`getCanonicalRefNameFn` wrapping it — which is not six answers converging so
much as evidence about the shape the layer-level one should take: **resolve on
receipt through the assembly's alias table**, not invert the outbound map. The
remaining three differ because they avoid the return direction rather than
implement it.

## Why synteny is the worst case rather than a special case

For every other plugin the un-requested refName is an occasional extra — one
field, one place to remember. For synteny it *is* the payload: every feature
names a contig on the other axis, because that is what a synteny feature is. So
where alignments has one cross-boundary read to get right, synteny has one per
reader, and the readers grew without anyone noticing the class.

That is also why the fix is at the two channels rather than at the thirteen
readers, and why it stays there: a fourteenth reader is written by adding one
line to a file that already reads `getFeatureAtIndex`, and nothing about writing
it would prompt anyone to think about namespaces.

Two channels carry names off the wire into synteny's main thread, and **both are
renamed on receipt** — `refNameDict` / `mateRefNameDict` in the fetch's `run`
(`LinearSyntenyDisplay/afterAttach`), `ResolvedSpan.refName` in
`resolveMatchingSpan`:

- `SyntenyFeatureData`'s `refNameDict` / `mateRefNameDict`, from the fetch —
  dictionary-encoded since the payload optimization below, so these are the
  DICTIONARIES the per-feature `refNameIds` / `mateRefNameIds` index. The worker
  comment at the head of `executeSyntenyFeaturesAndPositions.ts` says why they
  leave the worker adapter-space: the RPC worker has no assemblyManager, so
  reconciliation happens on the main thread *before* the call
  (`renameRegionsForAdapter`), and the features are handed back unmodified.
- `ResolvedSpan.refName`, from `SyntenyResolveMatchingRegion`. Read off the
  feature in `resolveAlignmentSpan.ts`, so it is the file's spelling in the
  worker and canonical from `resolveMatchingSpan` outward.

**They are canonicalized together, and a change that separates them is a
regression even though both halves look like improvements.** Doing only the
first is worse than doing neither: `alreadyShowing` then compares canonical
against adapter-space, never matches, and renavigates on every wake — breaking
the one-RPC-per-settle invariant `LinearSyntenyFollow.test.tsx` pins. That
failure is louder than the one the fix is for, which is the useful property
here: the guard against a half-revert is a test that already exists.

`getCanonicalRefNameFn` (`@jbrowse/synteny-core`) is the resolver for both, built
**per axis** — the query assembly for the `refName` lane, the target for the
`mate` one — rather than one shared, so two contigs spelled alike on the two
assemblies cannot collide. It reads the assembly's alias table
(`getCanonicalRefName2`), which is what alignments and breakpoint-split do too.

It replaced `getAdapterToCanonicalRefNameMap`, which these channels reused
because the diagonalize RPCs already had it. **That one is for a worker** — it
exists so a worker with no assemblyManager can be handed the answers — and
against a live assembly it is both more work and less total: it inverts
`loadRefNameMap`'s `result[canonical(fileName)] = fileName`, which is keyed by
canonical name and therefore keeps ONE file spelling per contig. Its header says
so; use it only where there is no assembly to ask.

**The axes are named by `assemblyNames[0]`, captured before the RPC, not derived
from `displayedRegions` after it.** Those are MST nodes and a comparative fetch
can outlive the level that started it, where reading one throws into an
unawaited promise — the same hazard `renameRegionsIfNeeded` captures its names
early to avoid.

### The first channel is a dictionary, which makes the rename cheap and adds one requirement

**Cheap:** it is a pass over a few dozen dictionary entries once per fetch, not
over a string per feature. An earlier plan carried a "skip the walk when the map
is empty" guard to keep a per-feature pass off the common path; against a
dictionary the walk is negligible either way, and the guard was dropped.

**The requirement: RE-INTERN after renaming**, which is what
`renameDictLane` exists to do and why it is not a `.map()` in place. The
dictionary's entries are distinct by construction while they are adapter-space,
because the worker interned them there. Renaming can collapse two of them onto
one canonical name, and **one aliased spelling is enough to do it**: a file that
spells a contig `chr1` on some rows and `1` on others, against an assembly
canonicalizing `1`, arrives as two entries and leaves as one — the renamed
`chr1` lands on the `1` that passed through unchanged. Duplicates break the readers
that resolve a name to an id ONCE and then compare integers
(`pickFollowFeature`, `followWindowMapping`, both via `dict.indexOf`): `indexOf`
finds the first of the duplicates, and every feature carrying the second id
silently stops matching.

The per-feature id array comes back **untouched** unless a collapse actually
happened, because the interner hands out ids in first-seen order — so the
ordinary file pays the dictionary walk and nothing else, and only the file that
needs the remap pays for it.

**That file is half-broken going OUT, too, and no rename here fixes it.** The
region the worker is asked for is renamed through the same one-spelling-per-contig
map, so it goes out as whichever spelling `loadRefNameMap` kept and the rows under
the other one are never fetched at all. Canonicalizing the return direction makes
the features that *do* arrive readable; the missing half is a core-level defect in
`loadRefNameMap` and is not on this page's list because nothing in synteny can
close it.

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

Fixed, for free, by the dictionary rename — the lookup's operand is now
canonical like `nameOrder`. Kept here because it is the shape to recognize
rather than the bug: a straddle whose failure mode is a *legitimate state*
reached wrongly survives an audit, and this one survived several.

## Every synteny site, and what each one was doing wrong

The audit result, filed rather than described — an earlier version of this thread
reported a reader count and left the list in the session, so the next reader had
to redo it.

Every one of these is fixed by the two renames above; the table is kept because
it is what says *why the fix is at the channels* and what a fourteenth site would
cost. The symptom column is the behaviour before the fix, and it is also what a
half-revert reintroduces.

**Method, so it can be re-run rather than trusted:** grep the two channels'
readers (`getFeatureAtIndex` / `getFeature` for the first, `ResolvedSpan` for the
second), then read each hit and name its *two* operands. A site is a straddle only
if one operand comes from a feature and the other from view state — that is the
rule at the top of this file, applied one site at a time. Run it again before
adding a channel; it is cheap and it is how this list stopped being a number.

Channel 1, `refNameDict` / `mateRefNameDict` reached through `getFeatureAtIndex`:

| site | the other operand | class | symptom, on an aliased file, before the fix |
| --- | --- | --- | --- |
| `components/util.ts` `getTooltipLines` | none, it is printed | display text | the tooltip shows the file's spelling |
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
| `moveMatchingPanel.ts` `navToResolvedSpan` | `navToLocString`'s parser | safe — the parser canonicalizes (below) |
| `positionViewOnSpan.ts` | `bpToOffset`, core, plain `string` | **straddle, and the site branding cannot catch** |
| `followTransform.ts` | its own `refName` is the window's | carrier — `targetRefName` is the span's and flows out through `applyFollowTransform` |

Thirteen sites; eight straddle. The count differs from the "eleven" this thread
first reported because carriers and producers can be counted either way — which is
the reason to keep the table rather than the number.

**`navToResolvedSpan` was a straddle in the first draft of this table and is
not.** `navToLocString` → `parseLocStrings` → `generateLocations` resolves every
refName through `asm.getCanonicalRefName` before it builds a location, so an
adapter spelling that is an alias already navigated correctly (probed, not
reasoned: `navToLocString('A:10000..11000', 'volvox')` lands on `ctgA`). It is
listed rather than deleted because the mistake is instructive — a channel-2
consumer can be safe *because a core function normalizes for it*, and that is
also why fixing channel 2 shows up in `alreadyShowing` and `positionViewOnSpan`
and nowhere a navigation would reveal it.

### The one that goes back OUT is safe, and was safe before the fix too

`moveMatchingPanel` puts `feat.refName` into `SyntenyResolveMatchingRegion`'s
`regions[]`. That looks like a straddle and is not, in either direction, and it is
worth knowing precisely because it can be "fixed" wrongly from both sides:

- **Before** it worked by accident. The method extends
  `RpcMethodTypeWithRenameRegions`, so the outbound pass renames `regions[]`
  canonical→adapter through a map keyed by *canonical* names. An
  adapter-only spelling is not a key, misses, and passes through unchanged — which
  is the spelling the worker wanted.
- **Now** it works by design: the name going in is canonical, the outbound rename
  maps it, the worker gets the same string.

So do not special-case this site and do not canonicalize it twice — the source
says as much at the call. The one input that breaks it is a file spelling a
contig with a name that is *also* the canonical name of a different contig, where
the pass-through miss becomes a wrong hit; pathological, and it was broken before
for the same reason.

## What is done, and what is still open

**Done: canonicalize both synteny channels.** All nine straddles and both
display-text sites at once, because everything in the tables reads through
`getFeatureAtIndex` or `ResolvedSpan`. `LinearSyntenyRefNameAlias.test.tsx` is
the gate and `LinearSyntenyFollow.test.tsx`'s RPC count is the guard against the
half-done version. It is one plugin's answer, not the class's, which is the whole
of what remains:

1. **Brand the out-of-request names** so a fourteenth site cannot appear quietly.
   Now the cheap moment to do it, and that ordering was the point: branding a
   fixed tree is a type-only change, branding a broken one buys an error list to
   wade through. Both ends have to be branded (the trap below), and
   `positionViewOnSpan` is known to be out of reach.
2. **A return-direction rename at the RPC layer, declared per method.** It would
   collapse all six workarounds in the table above into one mechanism, and no
   plugin would need per-site work. Much larger, and it wants a design pass rather
   than a patch — but it is the only option that stops the seventh plugin
   inventing a seventh answer, and synteny's fix did nothing to make that less
   likely. If anything it made it likelier: the class now looks handled.

   Two things are settled about it even though the design is not, and they are
   worth not re-deriving. **Per method rather than blanket**, mirroring
   `RpcMethodTypeWithRenameRegions` on the way out: most RPC returns carry no
   refName at all, and `resolveMatchingSpan`'s `regions[]` is the worked example
   of a return that deliberately passes a name back OUT and would break under a
   blanket pass. And **start from the alias table, not from the outbound map** —
   three of the six workarounds now resolve on receipt through
   `getCanonicalRefName2` (or synteny's `getCanonicalRefNameFn` around it) rather
   than inverting the map, which is the shape to build, because the outbound map
   is keyed by canonical name and inverting it keeps only one file spelling per
   contig and so is not total.

   **It is not urgent**, because every plugin that needs it now has a working
   answer, and the case for doing it rests entirely on that seventh plugin, which
   by definition has not been written yet. That is why it is recorded here rather
   than in `TODO.md`.
3. **The display-text half, repo-wide.** Independent of both of the above, and
   the one still unopened because nobody has decided it is work. A refName used as
   tooltip or feature-detail text shows the file's spelling in every plugin. The
   per-view fix is cheap and needs none of the machinery here — the dotplot
   tooltip is the worked example, ~10 lines resolving both axes through `pxToBp`
   instead of reading the fetched name. What that does not answer is whether it is
   worth doing twenty times.

## When it was observable, and what still is

Only when a file spells a contig with a name the assembly knows as an **alias**.
The map `loadRefNameMap` builds is `result[getCanonicalRefName(fileName)] =
fileName`, so it is identity whenever the file and the assembly agree — which is
every config we ship, because their FASTA and their alignment file come from the
same provider. Mixed provenance is the trigger: a minimap2 PAF over NCBI or
Ensembl downloads against a UCSC assembly.

`products/jbrowse-web/src/tests/LinearSyntenyRefNameAlias.test.tsx` is the
fixture — two PAFs describing one alignment, differing only in whether the query
contig is spelled `ctgA` or `A`, which `test_data/volvox/config.json` already
declared as an alias. Both load, both draw, and both follow; the file's first
test is that an aliased file is not a broken file, which is the premise the other
two rest on.

A third, `volvox_alias_target.paf`, exists to **tell the two axes' resolvers
apart**, and the reason it is needed is worth knowing before trusting a
green run of the other two: volvox_del declares no aliases, so on the query-axis
fixtures the target resolver is identity, and using one resolver for both
dictionaries — or deleting the mate rename outright — passes every assertion
they make. It is the same alignment transposed, so volvox is the axis that is
*not* queried and its `A` reaches `mateRefNameDict`, and it carries **no CIGAR**
on purpose: with one, channel 2 canonicalizes the answer whatever the dictionary
holds, and only the interpolating path reads `feat.mate.refName` as the sole
source of the name. It asserts on the dictionaries rather than on where a row
lands, because `navToLocString` resolves aliases itself (above) and would hide
the difference.

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

## One site outside both channels, reasoned rather than probed

`LinearDerivativeVsRef/buildDerivativeVsRefSpec.ts` has two `refName` uses and
only one of them is a refName at all. `derivativeName(candidate)` is a name this
function MINTS for the derivative contig (`der_9_9`); it belongs to neither
namespace and needs nothing. `seg.refName` is the reference contig a segment came
from, it reaches here off BAM features through `plugin-alignments`'
`computePaths`, and it becomes both the reference panel's **displayed regions**
(`lgvRegions`) and the positions of the `FromConfigAdapter` features drawn on
them.

It is the one site in this whole audit that is a *requested* refName being read
rather than an un-requested one, which is why it did not look like the others and
why the rule at the top of this file does not settle it: the two operands agree
with each other, and the question is instead whether an adapter-spelled name can
be a view's `displayedRegions` at all.

**Treat this as unverified.** Nothing here has been run — it is reasoned from the
shape of the code, and this thread's own record is that reasoning about it was
wrong three times out of four. The probe that settles it: a BAM whose header
spells a contig as an assembly alias, then read the reference panel's
`displayedRegions` after building a derivative.

## A third namespace in the same payload: ASSEMBLY names

Found by asking what else in `SyntenyFeatureData` is compared against view
state, and it is the same defect one field over — **probed, and fixed with the
refName lanes**, so it is here as the shape to recognize rather than as an open
item.

`mateAssemblyNameDict` carries the adapter's `assemblyNames[]` verbatim, which is
**config text**. `pickFollowFeature` and `followWindowMapping` look a view's
`assemblyNames[0]` up in it, and `centerOnFeature` compares the two directly —
all canonical, because a view's assembly names come off the assembly's own
regions.

An assembly config may declare `aliases`, and a synteny track naming its second
assembly by one is **still offered on the level**: `syntenyTrackRows` resolves
track assembly names through `canonicalAssemblyNames`. So the track loads, the
ribbons draw, and only the id lookup misses — and a miss is not a skipped filter.
`dict.indexOf` gives -1, no feature carries -1, every candidate is dropped, and
the follow reports the whole window unaligned. Identical symptom to the refName
bug, from a different namespace, and nothing in the refName audit would have
found it.

**Only the mate lane is canonicalized.** `assemblyNameDict` goes back OUT —
`feat.assemblyName` becomes `SyntenyResolveMatchingRegion`'s `regions[]` assembly,
which the adapter matches against its own `assemblyNames[]` — the same "safe
because it leaves again" as `feat.refName`, and canonicalizing it would break a
lookup that works today.

The outbound direction is handled before the RPC: `renameRegionsForAdapter`
respells every region's `assemblyName` into the adapter's own `assemblyNames`
through `regionsInAssemblyNamespace` (synteny-core), the same way the
region-launch mate discovery and `LGVSyntenyDisplay`'s fetch do, so a track
aliasing its **first** assembly draws. A region that still reaches a pairwise
adapter's `getFeatures` unrespelled is refused with `AssemblyNotInAdapterError`
rather than answered with an empty band.

The probe, which is now `volvox_asmalias.paf` in the fixture: a track whose
second `assemblyNames` entry is `vvx` (volvox's declared assembly alias) with
every refName canonical, so the two namespaces cannot be confused. Before the
fix, `mateAssemblyNameDict` read `['vvx']` against a view on `volvox`,
`followUnaligned` was true, and the row never moved.

## The repo-wide half nobody notices

A refName used as **display text** is wrong everywhere, not just in synteny: a
feature detail panel or tooltip on any aliased file shows the file's spelling
rather than the assembly's. It is cosmetic, universally unnoticed, and the same
defect.

Synteny's two display-text sites came along with the channel rename, and the
dotplot's tooltip was already doing the canonical thing, so the two comparative
views no longer demonstrate it. **Every other plugin still does** — which is
worth knowing before reading this doc as closed, and before describing the
underlying thing as a synteny bug.

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
