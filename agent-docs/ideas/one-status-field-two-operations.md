---
name: one-status-field-two-operations
description: A display's status field is aggregated across its concurrent REGIONS, by createStatusFanOut, but not across its concurrent OPERATIONS — so a bare-autorun fetch lending the display's window blanks the field its region fetches are still writing when it ends. Latent today because the one display with both gates one on the other; the fix is a per-display fan-out, which is a design decision rather than a patch.
---

# A display's status field has no aggregation across operations

`createStatusFanOut` solves last-writer-wins for the N concurrent **regions** of
one fetch: each takes a slot, the shared status is re-derived from all of them,
and the batch reads as one bar. One level up there is no equivalent. A display
that runs two *different* operations at once — its viewport region fetches
through `FetchMixin.runFetch`, plus something in a bare autorun through
`createStopTokenRotation` — has both writing one `statusMessage`, last writer
wins, with no slot between them.

The sharp end is not the interleaving, which merely looks untidy. It is
`StatusStream.clear`. When a rotation is **lent** the display's window (the
`StatusReporter.statusWindow` member, which exists so the two do not open two
windows on one field), `ActiveFetch.end()` calls `stream.clear()` — and that
resets the shared window and writes `undefined` to the shared field. So the
bare-autorun fetch *ending* blanks a label the region fetches are still
producing, and drops whatever they had queued behind the throttle. The overlay
renders a missing label as its `'Loading'` fallback, so the visible result is a
flash of "Loading" inside a load that never stopped — the exact symptom ADR-080's
"Things outside the fan-out" section is a list of.

`clear` is right to behave that way. It is documented as the owner's last word,
deliberately unguarded by `isCurrent`, because closing the guard and then
clearing is how an owner stops a still-running *sibling run of its own
operation* from writing over the clear. What it cannot distinguish is a sibling
that is a different operation entirely.

## Why it is latent rather than live

One display composes both today: `MultiSampleVariantBaseModel`, whose sources
fetch runs through `getMultiSampleVariantSourcesAutorun`. Its region fetch
declines until `sourcesBase` lands — that is what `FetchMixin.awaitingPrerequisite`
is declaring — so in the ordinary case the two never overlap.

That is a property of one display's gating, not an invariant of the seam:

- `awaitingPrerequisite` is an opt-in hook a display overrides, so the next
  display to lend its window need not have it.
- `reload()` wakes both autoruns, and the sources autorun carries `delay: 1000`
  while the region fetch does not.
- `begin()` also calls `statusWindow.reset()` on the lent window, so every
  sources fetch *starting* drops a region fetch's queued trailing write. Harmless
  in isolation, and the same coupling.

## The shape of a fix, and why it is a decision

The honest fix is that a display's status field gets a fan-out of its own, and
every operation on that display takes a slot rather than writing the field:
region batches take one slot for their whole (already aggregated) stream, the
rotation takes another. `aggregateStatus` then arbitrates between them the way it
already arbitrates between regions, and `clear` becomes "retire my slot" instead
of "blank the field".

Two things make that a design call rather than a patch:

- **What does a two-operation aggregate even mean?** ADR-072's rule is that only
  operations in the same phase are summable. A sources fetch and a region fetch
  are never in the same phase, so the aggregate is always the rank rule picking
  one — which is fine, but it means the answer is "whichever operation started
  its phase first holds the label", and that is a product decision about what the
  user should be told, not an arithmetic one.
- **It changes what `clear` means for every owner**, including the six that have
  exactly one operation and for which the current meaning is correct and simpler.

Cheaper alternatives, if the symptom ever shows up before anyone wants the above:
have `end()` skip the `write(undefined)` when the window is a lent one (the
rotation knows — `report.statusWindow` was supplied), and leave the reset; or give
`StatusReporter` a "someone else is still reporting" predicate. Both are narrower
and both put the knowledge in the wrong place, which is why neither is the entry.

## Related

- ADR-080 for why the end of a batch is the owner's to declare.
- ADR-041 for why `FetchMixin` and `BaseDisplay` declare their status fields
  separately rather than sharing a mixin, which is the reason there is no single
  place to hang a per-display fan-out today.
