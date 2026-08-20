---
name: two-axis-synteny-fetch
description: Restoring the both-rows synteny fetch. PARTLY SHIPPED 2026-08-19 behind `bidirectionalFetch`, off by default — the second query lands and the class with no second endpoint is marked on the target axis. The blocker this doc recorded (a perspective-stable `syntenyId` for PIF and all-vs-all) turned out not to be one: a disjointness predicate replaces the join. What is left is the RIBBON half, and this doc is now about that.
---

# Fetch both synteny axes again, joined on `syntenyId`

The synteny fetch queries **one** axis (`executeSyntenyFeaturesAndPositions`:
"The query is on v1 (the query axis) only"). It did not always: an earlier
design requested from both the top and bottom `LinearGenomeView` rows and joined
the two results on a shared `syntenyId`.

That key still exists. `plugins/comparative-adapters/src/util.ts` emits

```ts
uniqueId: fileOffset + assemblyName,   // deliberately DIFFERENT per perspective
syntenyId: fileOffset,                  // deliberately the SAME
```

and `MCScanSimpleAnchorsAdapter.test.ts` pins the contract — `q.id()` differs
from `t.id()` while `q.get('syntenyId')` equals `t.get('syntenyId')`. MCScan,
BLAST and the in-memory PAF path all emit it. What was removed is the fetch that
used it, not the mechanism.

## Two things it buys

**It removes synteny's need for a return-direction rename.** See
[REFNAME_NAMESPACES.md](../reference/REFNAME_NAMESPACES.md): a one-way rename is
sufficient exactly while an answer describes a region the caller asked for, and a
single-axis fetch returns answers about two locations having requested one. With
both axes requested, each side positions features inside blocks it asked for —
structurally identical to an ordinary LGV display — and the mate refName stops
being information at all.

Not a reason to do this, and it was never the strongest one: the two renames
synteny needs now exist and are a few dozen dictionary entries per fetch — and
since they stopped inverting the adapter map and started reading the assembly's
alias table, they cost no adapter round-trip either. What this would buy is
deleting two cheap calls, and the other five plugins would still have their own.
Justify this change by the alignments it recovers, below.

**It recovers alignments the current fetch drops.** The same code comment admits
the class: "an alignment whose query coords sit outside this window but whose
mate is on-screen in v2." Today those are simply absent.

**But that is the smaller half, and it is no longer this doc's to claim.** The
user-visible complaint — "my locus is syntenic to something and the view says
nothing" — has two causes, and the *other* one costs nothing to fix:

- anchored on the **query** axis, mate on a contig the target view is not
  displaying → **already fetched**, discarded in the worker's decorate loop.
  This is [offscreen-synteny-mates](offscreen-synteny-mates.md), and on
  `demos/grape_peach_cacao` it is 73% of peach chr1's anchors.
- anchored on the **target** axis, mate outside the query window → never
  requested. This doc.

Read that one first. If it lands, the remaining case for a second fetch is
narrower and better defined than "the fetch is incomplete", which is how this was
pitched and is no longer specific enough to justify it.

## What shipped, and why the blocker below is not one

**2026-08-19: the second fetch landed** behind `bidirectionalFetch` (a view
property, off by default, a fetch-key input). `executeSyntenyFeaturesAndPositions`
queries `v2.fetchRegions` alongside `v1.fetchRegions` and feeds what comes back
to `targetOffscreenMates`, the mirror of
[offscreen-synteny-mates](offscreen-synteny-mates.md)'s collector, drawn as a
strip of marks on the TARGET axis with a click that navigates the row ABOVE.

**The join was never needed.** Everything below about `syntenyId` assumed the two
fetches have to be deduped against each other. They do not: they can be made
disjoint by construction with a predicate on WHERE THE QUERY END LANDS.

- query end inside `v1.fetchRegions` → the first fetch already returned it, drop
- query end on a v1 contig outside the window → a real ribbon, and the half
  still open (see below)
- query end on a contig v1 is not displaying → no second endpoint exists, so it
  is a mark, and that is what shipped

No key, no adapter change, no PIF format change, and — unlike a join — a wrong
predicate cannot silently draw one ribbon twice, because the thing it tests is
the same region set the first fetch was handed. `bidirectionalFetch.test.ts`
pins it, including the case a join would have had to catch: the same alignment
returned from both perspectives with two unrelated ids.

**Confirmed against the running app**, which is where a predicate like that can
still be wrong for reasons no unit test reaches:
`BIDIRECTIONAL=1 node website/scripts/probe-offscreen-mates.ts` on the
grape/peach figure's own view reports 2767 marks on the query axis and **74 on
the target axis, all to peach `NC_034012.1`** — the same 74 this doc measured
offline for the reverse stacking, arrived at down a completely different path.
The probe reports either lane.

**The adapters already answer from either side.** `PairwiseAdapterBase.sideFor`
picks the side off the queried region's own `assemblyName`, `orientPafRecord`
orients the row to it, and `orientAlignment` swaps the indel CIGAR
(`swapIndelCigar` forward, `flipCigar` reverse). All-vs-all indexes
`for (const flip of [true, false])`. Nothing in the adapters had to change.

## What is left: the ribbon half

An alignment anchored in the v2 window whose query end is on a v1 contig that IS
displayed, merely outside the window, is a ribbon this pass drops. Recovering it
needs the perspective flip — swap the ends and re-orient the CIGAR — and then
merging into the same `decorated` array the query fetch fills. Two silent
failure modes to test against, which is why it was not taken in the same pass:
a mis-flipped CIGAR paints indels in the wrong place and looks plausible, and a
hole in the predicate draws a ribbon twice at doubled alpha (the artifact
`markReciprocalDuplicates` exists to remove).

## The blocker as it was recorded — kept because it names real adapter behaviour

`executeSyntenyFeaturesAndPositions.ts` used to say a two-axis fetch "can't
dedupe q- against t-perspective rows (PIF gives them distinct file offsets, hence
distinct feature ids)." True of **ids** — but ids are distinct on purpose, and
`syntenyId` is the key that joins them. That comment has been narrowed to the
below.

Checked 2026-08-14, against `make-pif/pif-generator.ts` and
`AllVsAllPAFAdapter.ts`. Three adapters join today; two do not, for reasons that
have nothing to do with each other:

| adapter | `syntenyId` | joinable across perspectives? |
| --- | --- | --- |
| MCScan | `rowNum` | yes |
| BLAST | `i` | yes |
| in-memory PAF | record index | yes |
| **PIF** | `fileOffset` | **no** — see below |
| **all-vs-all PAF** | `record * 2 + (flip ? 0 : 1)` | **no**, deliberately |

**PIF.** Confirmed, not inferred. `pif-generator.ts` emits both perspectives as
two separate text lines per PAF record (`` pifRow([`t${c2}`, …]) +
pifRow([`q${c1}`, …]) ``), and then the whole file goes through
`sort -k1,1 -k3,3n` before bgzip. So the two rows are not merely at different
offsets, they are sorted arbitrarily far apart, and `fileOffset` carries no
recoverable relationship between them. Fixing it means writing a
perspective-stable key into the rows themselves — a tag holding the
query-perspective offset on both, or a hash of the alignment tuple — which is a
**file-format change**: existing `.pif.gz` files would not carry it, so the join
has to degrade gracefully or the feature has to require regeneration. That is the
real cost, and it is larger than "give PIF a better id" suggested.

**All-vs-all.** Numbers the two sides apart on purpose, because there they are
not two views of one alignment — they are separate drawables, and
`markReciprocalDuplicates` has already decided which genuine restatements to
collapse. A join key here would fight that pass rather than help it. Whatever
this doc becomes, all-vs-all wants the two-axis dedupe to be a no-op, not a
join.

## How much it would actually recover

Measured on `demos/grape_peach_cacao` (method and caveats in
[offscreen-synteny-mates](offscreen-synteny-mates.md)), whole chromosome each
axis, peach chr1 on top against grape chr1:

- class this doc recovers (anchored on grape chr1, peach mate off peach chr1):
  **74 anchors**
- class the cheap fix recovers (anchored on peach chr1, grape mate off grape
  chr1): **2767 anchors**

Stack them the other way and the two numbers swap, because the fetch follows the
top row. So this doc's class is not inherently the smaller one — but on any given
stacking it is the one you did **not** get for free, and a session proposing this
should measure its own case rather than reuse either number.

## Justify it on the dropped alignments, not on refNames

The refName class has a small fix (canonicalize two channels on receipt, the
same workaround five other plugins already use) and this is a large change. It
also would **not** finish that job: `SyntenyResolveMatchingRegion` asks "where
does this alignment put the other end", which is inherently an answer about a
location the caller did not request, and still needs the inverse rename.

So the case for this is fetch **completeness**. The refName class dissolving is
a bonus, and pitching it the other way round buys an architecture change with a
bug that has a cheaper fix.

## Costs to weigh

- Two fetches per level instead of one, against a whole-genome PAF.
- The dedupe moves from `f.id()` to `syntenyId`, which has to hold across
  every adapter, not just the three that emit a joinable one today — and for PIF
  that means a format change old files won't have.
- **A wrong join is worse than no join**, and it fails silently in the direction
  that looks fine. Two rows that should have merged draw one ribbon twice, which
  is exactly the doubled-alpha artifact `markReciprocalDuplicates` exists to
  remove ("the polygons are oddly darker than expected"); nothing errors, the
  band just composites at 0.36 where every other figure sits at 0.2.
- Feature ids are already not comparable across a tiered PIF's two tiers
  (`setRpcData`'s comment, and `lodMode` on the resolve RPC). A cross-perspective
  key has to survive that too, or it reintroduces the same trap one level down.
