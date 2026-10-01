---
name: two-axis-synteny-fetch
description: The both-rows synteny fetch: a second query on the target axis, flipped into the query perspective and drawn. Shipped 2026-08-19, on by default since 2026-09-07 as `showOffscreenMates`. Read before changing the synteny fetch's axes or the adapter behaviour it names.
kind: spec
---

# Fetch both synteny axes again, joined on `syntenyId`

**Shipped 2026-08-19, on by default since 2026-09-07 as the
`showOffscreenMates` checkbox.** The second query lands, its ribbons are
flipped into the query perspective and drawn, and the class with no second
endpoint is marked on the target axis. The blocker this file recorded — a
perspective-stable `syntenyId` for PIF and all-vs-all — turned out not to be
one. What follows is the design that shipped, kept for the adapter behaviour it
names.

The synteny fetch queries **one** axis (`executeSyntenyFeaturesAndPositions`:
"The query is on v1 (the query axis) only"). It did not always: an earlier
design requested from both the top and bottom `LinearGenomeView` rows and joined
the two results on a shared `syntenyId`.

That key still exists. `plugins/comparative-adapters/src/util.ts` emits

```ts
uniqueId: `${rowIndex}-${tier}-${assemblyName}`, // different per perspective
syntenyId: rowIndex ?? fileOffset,              // the same
```

`syntenyId` is the key that joins them.

Checked against `make-pif/pif-generator.ts`, `util.ts` and
`MultiGenomePAFAdapter.ts`. Four adapters join; all-vs-all does not, deliberately:

| adapter | `syntenyId` | joinable across perspectives? |
| --- | --- | --- |
| MCScan | `rowNum` | yes |
| BLAST | `i` | yes |
| in-memory PAF | record index | yes |
| PIF v2 | `pi:i:` row index | yes |
| PIF before v2 | `fileOffset` | no |
| **all-vs-all PAF** | `record * 2 + (flip ? 0 : 1)` | **no**, deliberately |

**PIF.** `pif-generator.ts` emits both perspectives as separate text lines per
PAF record and sorts the whole file before bgzip, so the two rows sit arbitrarily
far apart and `fileOffset` carries no relationship between them. A version-2
file writes a `pi:i:` tag naming the input row on every row, and `util.ts` reads
it as the row index when the header declares version 2. A file from before v2
falls back to `fileOffset` and does not join.

**All-vs-all.** Numbers the two sides apart on purpose, because there they are
not two views of one alignment — they are separate drawables, and
`markReciprocalDuplicates` has already decided which genuine restatements to
collapse. A join key here would fight that pass rather than help it. Whatever
this doc becomes, all-vs-all wants the two-axis dedupe to be a no-op, not a
join.

## How much it would actually recover

Measured on `demos/grape_peach_cacao` (method and caveats in
[offscreen-synteny-mates](OFFSCREEN_SYNTENY_MATES.md)), whole chromosome each
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

## Costs, and which of them the shipped shape still pays

- **Two fetches per level instead of one, against a whole-genome PAF.** Still
  true, and was the reason the setting shipped off; the on/off checkbox turned
  it on by default for the picture's sake. The in-memory adapters
  share one `createSharedSetup` download, so there the second is a walk over
  records the first already parsed; an indexed one pays a real second query,
  scoped to the target row's own window.
- ~~The dedupe moves from `f.id()` to `syntenyId`~~ — **not paid.** The two
  fetches are made disjoint by where the query end lands, so `f.id()` still
  dedupes within each and nothing compares ids across them. This is the whole
  reason this fetch needs no cross-fetch join key.
- ~~A wrong join is worse than no join~~ — **the failure mode moved.** There is
  no join to mismatch; what can be wrong is the predicate, and it is tested
  against the same region set the first fetch was handed. The doubled-alpha
  artifact it would have produced ("the polygons are oddly darker than
  expected") is what `bidirectionalFetch.test.ts`'s no-double-draw case exists
  for.
- Feature ids are already not comparable across a tiered PIF's two tiers
  (`setRpcData`'s comment, and `lodMode` on the resolve RPC). **Not paid
  either**, for the same reason: both fetches run at one `lodMode`, and no id
  crosses between them.
