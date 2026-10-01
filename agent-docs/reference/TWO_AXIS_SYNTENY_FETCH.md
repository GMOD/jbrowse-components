---
name: two-axis-synteny-fetch
description: How the both-rows synteny fetch works: a second query on the target axis, flipped into the query perspective and drawn when `showOffscreenMates` is on. Read before changing the synteny fetch's axes or the adapter behaviour it names.
kind: spec
---

# The second synteny fetch, on the target axis

`executeSyntenyFeaturesAndPositions` queries the query axis (the top
`LinearGenomeView` row). With `showOffscreenMates` on, a second query runs on
the target axis, its ribbons flip into the query perspective and draw, and the
class with no second endpoint is marked on the target axis (class B in
[offscreen-synteny-mates](OFFSCREEN_SYNTENY_MATES.md)).

The two fetches are disjoint by where the query end lands, so `f.id()` still
dedupes within each and no id or join key crosses between them. A wrong
predicate is the failure mode, tested against the same region set the first
fetch received; `bidirectionalFetch.test.ts`'s no-double-draw case guards the
doubled-alpha artifact. Feature ids are not comparable across a tiered PIF's
two tiers, and both fetches run at one `lodMode`, so none cross.

## `syntenyId`

`plugins/comparative-adapters/src/util.ts` gives each alignment a
perspective-specific `uniqueId` and a perspective-stable `syntenyId`
(`rowIndex ?? fileOffset`).

| adapter | `syntenyId` | stable across perspectives? |
| --- | --- | --- |
| MCScan, BLAST, in-memory PAF | row or record index | yes |
| PIF v2 | `pi:i:` input-row tag | yes |
| PIF before v2 | `fileOffset` | no |
| all-vs-all PAF | `record * 2 + (flip ? 0 : 1)` | no, deliberately |

- PIF writes both perspectives as separate lines per PAF record and sorts the
  whole file before bgzip, so `fileOffset` relates nothing. The `pi:i:` tag
  carries the input row when the header declares version 2.
- All-vs-all numbers the two sides apart because they are separate drawables,
  and `markReciprocalDuplicates` has already decided which restatements to
  collapse. A join key would fight that pass, so the two-axis dedupe must be a
  no-op there.

## Costs

- A whole-genome PAF pays two fetches per level. In-memory adapters share one
  `createSharedSetup` download, so the second is a walk over parsed records; an
  indexed adapter pays a real second query scoped to the target row's window.
  This cost is why the setting shipped off first.
- Justify changes to this fetch by completeness of the dropped alignments, not
  by refNames. The refName class has a cheaper fix (canonicalize two channels on
  receipt), and `SyntenyResolveMatchingRegion` still needs the inverse rename
  either way.
- How much the second query recovers depends on which genome is on top; measure
  the case in hand rather than reusing a number.
