---
status: Accepted
summary: 'A status field aggregates across the concurrent OPERATIONS that share it, not just the regions of one fetch; a stream ends by retiring its slot, and blanks the field only when it was the last'
---

# ADR-081: A status field is one fan-out, and `clear` retires a slot

## Status

Accepted

## Context

ADR-080 settled how the N concurrent **regions** of one fetch share a display's
status field: `createStatusFanOut` gives each a slot, re-derives the shared
value from all of them, and lets the owner declare the end. One level up there
was no equivalent. A display runs more than one operation at a time — its
viewport fetch through `FetchMixin.runFetch`, a bare-autorun fetch through
`createStopTokenRotation`, a clustering run through `setupRunClusteringAutorun`
— and each of them wrote the one `statusMessage` directly, last writer wins.

The sharp end was not the interleaving. It was that each of them **blanked the
field when it finished**: `StatusStream.clear` reset the shared window and wrote
`undefined`. So an operation ending wiped a label the others were still
producing, and dropped whatever they had queued behind the throttle. The
loading overlay renders a missing label as its `'Loading'` fallback, so the
visible result is a flash of "Loading" inside a load that never stopped — the
symptom ADR-080's "Things outside the fan-out" section is a list of.

`clear` was right to behave that way for a single-operation owner, and it is
documented as the owner's last word, deliberately unguarded by `isCurrent`,
because closing the guard and then clearing is how an owner stops a still-running
*sibling run of its own operation* from writing over the clear. What it could
not distinguish is a sibling that is a different operation entirely.

**It was live, not latent.** `MultiSampleVariantBaseModel` composes both fetch
families, and its `awaitingPrerequisite` gate — the region fetch declines until
`sourcesBase` lands — only holds for the *first* load. Nothing clears
`sourcesVolatile`, so on `reload()` the cellData fetch starts immediately while
the sources autorun, carrying `delay: 1000`, starts a second later: two fetches
in flight, and the one that finishes first blanks the other's label. That is the
retry path, which is exactly when someone is watching the loading UI. Clustering
had no gate at all — `setupRunClusteringAutorun` wrote
`setStatusMessage(undefined)` in its `finally`, over a viewport fetch that a pan
could have started at any point during the many seconds a cohort-sized cluster
takes.

## Decision

**A status field is a fan-out over the operations that share it.** Every
operation takes a slot rather than writing the field, `aggregateStatus`
arbitrates between them the way it already arbitrates between the regions of one
fetch, and `StatusStream.clear` means "retire my slot" — which blanks the field
only when no other operation is still reporting.

The window is where it lives, because the window is already one-per-owner:
`createStatusWindow(write)` takes the field's single writer at creation, and
`open({isCurrent})` returns a slot on it. That makes two rules structural that
were previously prose:

- **The field has exactly one writer**, so whatever guards it — `isAlive(self)`,
  a React `alive` flag — guards every status and every clear by construction,
  rather than by a copy of the check at each `finally`. `open` used to take a
  `write` per stream, which is a place for two streams on one field to disagree.
- **The window reopens when the field goes idle**, which is what retiring the
  last slot does. No owner resets by hand around a fetch any more;
  `StatusWindow.reset` is for teardown, where the trailing timer outlives
  everything that could make it a no-op.

Three things follow at the call sites, and each of them deletes a rule somebody
had to remember:

- `FetchMixin.supersedeStatus` is gone. Superseding was the one case where the
  display does not stop loading, and it needed its own action to keep the label
  while dropping the token. Now the superseded fetch's slot simply goes on
  voting until its `finally` retires it, and `runFetch` opens the replacement's
  slot **before** superseding, so the handover has no gap. Same in
  `createStopTokenRotation.begin`.
- A superseded run must retire its slot, so `runFetch`'s `stream.clear()` and
  the rotation's `end()` are unconditional — where the old rotation asked
  `isCurrent()` first, precisely to avoid wiping the replacement's label.
- `makeStatusCallback` became `openStatusStream`, returning the callback and the
  clear together. A caller taking the callback alone was taking a slot it had no
  way to retire.

**Hold the last determinate reading only where the slots are raw reporters.**
ADR-080's rule that a phase does not lose its bar because nothing is measuring
it *this instant* is about one batch's peers sitting between reads. A slot fed
by another aggregate has already had the rule applied to it: its bare label
means "my children have no measurement", not "I am between reads". Re-applying
it one level up puts back a percentage the child deliberately retired — the
write ADR-071 exists to cancel — and the commonest window has exactly one slot,
where a held reading can only ever be older than what that slot just said. So
`createStatusFanOut` holds and `createStatusWindow` does not, and the shared
`createStatusAggregate` takes it as a flag rather than leaving two copies of the
arithmetic to drift.

### What a two-operation aggregate means

ADR-072's rule is that only operations in the same phase are summable, and a
sources fetch and a region fetch are never in the same phase. So the aggregate
is always the rank rule picking one: whichever operation reached its phase
first holds the label, and the bar under it is that phase's own. That is not a
new product decision — it is ADR-080's rule applied to a wider set of slots, and
a straggler holding the label is the reading it already chose.

The one thing the wider set needs is a batch boundary, since a display outlives
any of its fetches. Retiring the last slot is that boundary: it clears the phase
order along with the field, so a rank recorded an hour ago has no business
ordering today's phases.

## Rejected alternatives

**Have `end()` skip the `write(undefined)` when the window is a lent one.** The
rotation knows — `report.statusWindow` was supplied — so this is three lines and
it fixes the reported symptom. It puts the knowledge in the wrong place: the
rotation would be deciding what the display's *other* operations are owed, from
the one fact it happens to hold about them. It also fixes nothing for
clustering, which lends no window and blanks the same field.

**Give `StatusReporter` a "someone else is still reporting" predicate.** Same
objection with more surface: every operation would have to be told about every
other one, and the answer it needs — what should the field say now — is the
aggregate, which is the thing being avoided.

**Keep a retired slot's `completed` totals.** A landing batch's bar is kept from
walking backwards by remembering what each slot finished (ADR-080), so the
instinct is to keep that when a slot retires. One operation's bytes were never
the denominator of another's — they are never in the same phase — and a slot
kept for its `completed` alone is exactly the accumulation a long-lived
aggregate cannot afford. Retiring drops it.

**Aggregate at the display and leave `clear` blanking.** The two are one change.
A field written by an aggregate but blanked by any participant is the current
bug with an extra layer.

## Consequences

- **A phase's `''` no longer reaches the field as a blank.** The window writes
  what its slots add up to, and an idle aggregate writes the last label alone —
  the same rule ADR-080 gave the fan-out, now one level up. Between the last
  region retiring and the owner's clear the label therefore stays up instead of
  flashing "Loading". The owner's clear is what blanks it, as before.
- **An operation that never retires its slot pins a label up for good**, where
  before it merely lost a race. That is the failure mode this trades for, and it
  is why `openStatusStream` hands back the clear beside the callback and why
  `createStopTokenRotation.dispose` retires a fetch that was in flight when the
  host went away.
- `FetchMixin` gains an `activeStatusStream` volatile, so a cancel can retire
  the slot now rather than whenever the worker notices the stop token.
- `createStatusWindow` taking its `write` at creation means `FetchMixin` builds
  it in a volatile initializer that reaches forward to an action three chain
  steps later — a cast, named `StatusWriter`, to the one member it calls.
  Adding a `.volatile` after the actions instead would have been type-safe and
  is the edit ADR-041 says not to make.
- **Renames.** `FetchMixin.makeStatusCallback` → `openStatusStream` (returns the
  stream, not the callback); `FetchMixin.supersedeStatus` deleted;
  `createStatusWindow()` → `createStatusWindow(write)` and
  `open({isCurrent, write})` → `open({isCurrent})`. None of them had shipped in
  a release.
