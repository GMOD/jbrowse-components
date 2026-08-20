---
status: Superseded
summary: 'One phase at a time is summable and the rest are charged as unmeasured — that half stands. Which phase is no longer the one holding the most slots: ADR-080 takes the earliest the batch is still in, because a majority changes hands as regions cross and the label went back and forth with it'
---

# ADR-072: Only operations in the same phase are summable

## Status

**Superseded on which phase wins; the incommensurability half stands.**

Phases are still not summable across, one of them is still the only one summed,
and every other in-flight slot is still charged the mean. What ADR-080 replaces
is the sentence below that picks it: *"the phase most of them are in"*. A count
changes hands as regions cross a boundary and changes back as they finish, so
three regions of different sizes made the label read `Downloading features` →
`Computing layout` → `Downloading features` → `Computing layout` inside one
fetch. It is now the earliest phase the batch is still in, which it leaves when
its last slot does.

The worked example below is unaffected — three downloading beside one laying out
picks `Downloading features` under either rule. The two differ only when the
majority has moved *ahead* of a slot that has not.

## Context

`aggregateStatus` folds the statuses of several concurrent operations into the one
status the loading UI shows — one slot per visible region in the LGV fan-out. It
summed every determinate slot into a single Σcurrent/Σtotal bar, on the stated
reasoning that `current`/`total` are unit-agnostic and additive.

They are additive within a phase and not across one. `executeRenderFeatureData`
measures bytes while downloading and features while laying out, and the regions of
one fan-out cross that boundary at different times, so the sum routinely mixed the
two. The units differ by about three orders of magnitude, which makes the sum a
bar scaled by whichever slot holds the larger raw total:

| slots                                          | fraction shown |
| ---------------------------------------------- | -------------- |
| download `0/400000` + layout `150/300`         | 0.04%          |
| the byte slot retires, layout still `150/300`  | 50%            |
| download `399000/400000` + layout `0/300`      | 99.7%          |

The layout region's real progress sat below the noise floor of the byte counts,
and the label was chosen independently (`determinate[0].message`), so the text
could name a phase contributing nothing to the number.

## Decision

Sum only the slots in the phase most of them are in; charge every other in-flight
slot as unmeasured, which is what the function already did for a slot reporting no
total at all. A tie breaks to the earliest slot, so a fan-out whose slots all
share one phase — the common case, and the case the sum was written for — is
aggregated exactly as before. Every pre-existing test passed unchanged.

## Rejected alternatives

**Average the per-slot fractions.** Simpler, and it needs no notion of a phase.
Rejected because it discards size: two regions, one 10x the other, are not half
done when the small one finishes. Σ within a phase weights by the work each
region actually represents, which is the property the original sum had right.

**Normalize each slot to a fraction worker-side, so every slot reports the same
unit.** The honest version of the sum, and rejected in ADR-071 for its own
reasons: the weights that convert phases into one fraction are wrong by
construction, and every producer would have to adopt it in step.

## Consequences

- The bar still drops when a slot retires, because a bar over in-flight work
  alone loses denominator as operations finish. That is a separate, known
  property — the `''` note on `aggregateStatus` records why charging retired
  slots is worse (the bar runs backwards instead) — and this ADR does not change
  it. What it removes is the *false* reading, a bar near full because of a
  neighbour's unit rather than because the work was nearly done.
- ~~A fan-out split evenly between two phases picks one arbitrarily, by slot
  order.~~ Superseded: it picks the earlier of the two, and keeps picking it
  until the last slot leaves. See ADR-080.
- ADR-071 hid most of this defect by keeping sub-window statuses off the screen,
  which is the reason to fix it deliberately rather than the reason it is fixed.
