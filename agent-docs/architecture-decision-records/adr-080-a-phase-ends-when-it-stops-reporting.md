---
status: Accepted
summary: 'A fan-out slot retires a phase on any status that is not that phase moving forward, credits it once, and never blanks the shared label'
---

# ADR-080: A phase ends when its slot stops reporting it

## Status

Accepted

## Context

`createStatusFanOut` gives each concurrent operation — one visible region's RPC,
in the LGV displays — its own status slot, and re-derives the one status the
loading UI shows from all of them through `aggregateStatus`. Two mechanisms kept
the shared bar honest as a batch landed:

- a slot's finished work was remembered, so the denominator did not shrink as
  regions retired and the bar did not walk backwards (`completed`), and
- only slots measuring the same phase were summed, the rest charged the mean of
  the known totals (ADR-072).

Both were keyed on `''`, the value a phase helper writes when its phase ends.
That is not the value a phase ends with in the shape the canvas feature fetch
actually runs. Phases nest: `executeRenderFeatureData` opens `Downloading
features` and the adapter opens *its own* byte-counted phase of the same name
inside it, so the download closes onto the **enclosing label** — a plain string —
and never onto `''`. Nothing was ever recorded as completed, and the region's
bytes left both halves of the fraction the instant its download finished.

The rest followed from there. A slot that had finished the winning phase and gone
on to the next was charged the unmeasured mean *on top of* the work it had
already completed, so the bar fell every time a region moved on. A tie between
two slots in different phases was broken by slot order, so the label and the
whole denominator under it swapped whenever either region crossed a boundary. And
an aggregate with nothing in flight wrote `''` — which a slot merely *between*
two phases produces just as a finished slot does — blanking the shared label,
which `LoadingOverlay` renders as its `'Loading'` fallback.

Two GFF3 regions of one assembly (`3:34,429,717..36,364,294` and `4:1..6,238,979`
on a cacao annotation track) reproduced all four at once: a label flapping
between `Loading` and `Downloading features` several times a second, under a
percentage that read 93, 97, 92, 89, 94.

## Decision

A determinate phase is over the moment its slot stops reporting it *forward*.
`createStatusFanOut` retires it — crediting its total to both halves of the
fraction — on any status that is not the same message with a non-decreasing
`current`: the enclosing label a nested phase closes onto, a different phase, a
second phase of the same name starting at zero (which is what tabix's redispatch
read is), and `''` as before.

`aggregateStatus` then prices each slot against the winning phase *individually*,
which is why it now takes `StatusSlot[]` — a status and that slot's finished
phases — rather than a flat list of each. A slot measuring the phase counts its
own numbers plus what it has already finished of it; a slot that finished it and
moved on counts that finished work and **nothing more**, no mean on top; a slot
with nothing comparable is charged the mean, as ADR-072 has it.

A tie between phases goes to the one the batch reached first, not to the earliest
slot. The fan-out records first appearance and passes it down.

The fan-out never writes `''`. An empty aggregate means "no slot is reporting
this instant", so it writes the last label alone — indeterminate, which is what
that state is. The label still has to be *written* rather than skipped: statuses
are throttled, and a write that lands is what displaces a percentage queued
behind the window (ADR-071).

Three further rules, all of them about not throwing away what we already know,
and all of them in the fan-out rather than in `aggregateStatus` — the arithmetic
stays honest and separately tested:

- **A phase does not lose its bar because nothing is measuring it this
  instant.** Between a slot's reads it reports the enclosing label alone, and
  when every slot is between reads at once the aggregate has no measurement — so
  the determinate bar dropped to an indeterminate spinner and came back a tick
  later, seven times in two seconds with three blocks taking their redispatch
  flanks. The phase's last reading is held and re-sent instead. Held **only for
  a gap between reads**, never once the aggregate is empty: nothing in flight at
  all is a bar that is over, and re-sending a percentage for ended work is the
  write ADR-071 exists to cancel.
- **The bar does not read complete while a slot is in flight.** A full aggregate
  is produced by every slot being between reads at that instant, and the next
  read starting takes it away again — the bar toggled 100/98 nine times. The
  phase ending is what moves the label on.
The bar can still step back a point or two when a slot opens a read nobody knew
was coming — see the rejected clamp below, which is where that stops.

## Rejected alternatives

**Have the phase helpers close onto `''` rather than the enclosing label.** It
would restore the one signal the fan-out was reading, and it is the change
`openPhase` exists to prevent: an inner phase blanking its caller's label for the
rest of the caller's work is the defect nesting was introduced to fix, and the
rule it replaced ("run phases in sequence, or give the inner one no
`statusCallback`") was a rule about code two files away from the call site.

**Skip the write entirely when the aggregate is empty.** Leaves the field alone,
which is most of what is wanted, but a status queued behind the throttle then
fires after the work it measured has ended — the bar comes back to 90% on a phase
that is over. `FetchMixin.test.ts` pins that.

**Clamp the shared fraction so it can never decrease.** Tried, measured, removed.
It produced a visibly better stream — the browser trace went strictly monotone —
and it cannot be made correct through composition, which is what settles it. A
region *joining* a batch is work that was not there before and the shared bar
must fall for it (`callEachRegion` and `FetchMixin` both pin that); the drops
worth suppressing are a slot re-entering a phase it has already been measured in.
Telling those apart at the writing slot works one level deep and fails the moment
fan-outs nest — MAF wraps `callEachRegion` in a fan-out of its own, and the inner
aggregate's legitimate drop arrives at the outer one looking exactly like a
re-entry. A smoothing rule that silently lies in the nested case is worse than a
bar that steps back a point.

The largest of those drops was never accounting anyway. Tabix's redispatch
re-read the *union* of the query and an overhanging feature's bounds, so a region
that had just reported 100% doubled its own denominator and dropped to 50%. That
is `readTabixLinesRedispatched` reading the query range twice, and it now reads
only the flanks; the bar was reporting it correctly.

## Two things outside the fan-out

The same symptom had two sources the fan-out cannot reach, both of which blanked
the label outright — and the loading overlay renders a missing label as its
`'Loading'` fallback, so each one reads as a flash of "Loading" inside a load.

- **The byte gate ran unlabelled.** It is the first thing a canvas feature fetch
  does, and no phase was open for it, so every fetch showed "Loading" until the
  download phase opened. It says `Checking region size` now; a phase shorter than
  the throttle window still paints nothing (ADR-071), so it speaks only when it
  is slow enough to be worth saying.
- **A superseded fetch cleared the label.** `runFetch` called `resetStatus` when
  another fetch replaced one in flight, which is the single case where the
  display does not stop loading — so a pan, or a linked view resyncing, flashed
  "Loading" between the phase it was in and the phase it was about to re-enter.
  `supersedeStatus` keeps the label and drops only the token and the throttle
  window; the fetch that actually *ends* still clears.

`localStorage.debugStatus = true` prints every write to a display's status field
with its fetch generation, which is the discriminator between these two families:
a flicker inside one fetch holds one generation, while a fetch superseded over
and over steps it every time.

## Consequences

- ADR-072's consequence "a fan-out split evenly between two phases picks one
  arbitrarily, by slot order" no longer holds — it picks the phase the batch
  reached first, and keeps picking it until the last slot leaves that phase.
- The shared label now outlives the batch by however long the owner takes to
  clear it. Every owner does clear it (`runFetch`'s `resetStatus`,
  `assembly.loadPre`'s `finally`, `createStopTokenRotation`'s `clearStatus`), and
  the end of a batch was never something the fan-out could see.
- The bar still goes indeterminate — label, no percentage — while every slot is
  between phases. It is a true statement about that instant, and the alternative
  is holding a number nothing is measuring.
- A slot can still be credited for a phase it *abandoned* (an aborted download
  counts at its full total), which is what `''` already did and is invisible: the
  stream ends with the fetch that aborted it.
