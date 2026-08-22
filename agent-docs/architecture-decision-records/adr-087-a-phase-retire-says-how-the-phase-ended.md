---
status: Accepted
summary: "A phase's retire carries whether the work finished, because the aggregate charges a completion its total and a throw only what it transferred, and the readings cannot tell the two apart"
---

# ADR-087: A phase retire says how the phase ended

## Status

Accepted

## Context

`aggregateStatus` charges a slot's finished phase to both halves of the shared
fraction, at the `total` the phase retired at (ADR-080's `completed`). That is
what stops the denominator shrinking as regions land, and it is why the bar
stopped running backwards.

It is also charged when the phase did not finish. `withProgress` and
`updateStatus` retire in a `finally`, so a region that read 100 of 1000 bytes and
then lost its socket retires exactly as one that read all 1000 — and is credited
1000. Two regions at 100/1000 and 500/1000 read 600 of 2000; the first one's
socket closing then read 1500 of 2000. The bar walks **forward** on a failure,
crediting 900 bytes nobody transferred.

`assembly.loadPre` is the same shape one level up: `Promise.all` rejects on the
first of four concurrent files while the other three are still downloading and
still reporting.

**No rule over the readings can separate the two cases.** Both arrive as the same
phase-over write, and on the per-region fetch path a phase clear *is* a
completion: `FetchMixin.test.ts` §"a region's phase clear charges it as complete"
pins that deliberately, because undercharging a clear is what made the bar run
backwards as a batch landed. Crediting `min(current, total)` on a retire was
tried on 2026-08-21 and fails that test by name.

## Decision

**The `finally` says which happened, because it is the only place that knows.**
`openPhase`'s close takes a `PhaseOutcome` — `'completed'` or `'failed'`,
pessimistic by default, so a throw or a cancel leaving the phase's scope retires
it as unfinished — and the aggregate credits `total` on a completion and
`current` on a failure.

The outcome travels as a **value on the channel**: `RpcStatus` gains a third
member,

```ts
interface PhaseFailure {
  message: string
  failed: true
}
```

where `message` is the same string the retire would have carried anyway — the
enclosing phase's label, or `''` when there was none.

Two properties are why it is a value and not a second callback argument:

- **It survives the seams.** `wrapForRpc` posts one status through the worker's
  `postMessage`, `WebWorkerRpcDriver` hands its listener one, and every
  `status => cb(status)` forwarder in the tree passes one. An extra argument
  would be dropped in silence at each of those, and a plain object crosses all of
  them for free.
- **A consumer that only understands the falsy-message retire is unaffected.**
  `statusMessageText` and `statusFraction` answer for `{message: '', failed:
  true}` exactly as they do for `''`, so a display field, an overlay or a job
  card sees no change.

The marker is consumed by the first aggregate it reaches: `createStatusAggregate`
credits the retiring phase and then stores the plain message in the slot. Nothing
downstream of an aggregate — a parent channel, a display's status field — can
observe the shape, and `createStatusFanOut` never forwards it.

`statusReading(status)` is the one place the union is narrowed to a
`current`/`total`, so a consumer reading the numbers cannot mistake a retire for
a measurement. It is the only new API a caller needs.

The two regions above now read 600 of 1100 where they read 1500 of 2000: the dead
region is charged the 100 bytes it moved, in both halves.

## Rejected alternatives

**Credit `min(current, total)` on every retire.** The rule the readings can
express, and it is wrong in the other direction: a phase clear on the per-region
fetch path is a completion, `current` is only its total written twice, and
charging it less is the backwards bar ADR-080 removed. Tried 2026-08-21, failed
`FetchMixin.test.ts` by name, reverted.

**Emit a truthful final reading before the retire** — `{message, current: n,
total: n}` — so the existing credit rule charges `n` with no wire change.
Rejected: that reading is 100% of a phase that failed, and if it lands rather
than being displaced inside the throttle window the bar jumps to full before it
clears. It also states a total the phase never had, which the next aggregate up
would repeat.

**A second callback argument**, `statusCallback(status, outcome)`. Narrower on
paper — the status value stays exactly what it is today — but the outcome has to
reach a *main-thread* aggregate from a *worker's* `finally`, and the seams between
drop it: the worker's status emitter, the driver's channel listener, every
forwarding wrapper. Each would need to learn about it, and forgetting one is
silent.

**Keep the failed phase's `total` in the denominator** (credit `current` to the
numerator, `total` to the denominator), so the bar does not move at all when a
region dies. Held, not rejected: it needs a pair per phase in `completed` rather
than one number, and it ends a failed batch at a fraction below 1 — arguably
right, but it is a second bookkeeping change on top of this one. Revisit if a
forward step on failure reads badly; the step is now the size of the *unmeasured*
remainder rather than the whole phase.

## Consequences

- A retire is no longer always a bare string, so a transformer over the channel
  has to preserve the shape. `levelStatusCallback` in `runDiagonalize.ts` is the
  one transformer in the tree, and its existing rule is unchanged: the sentinel
  goes through unprefixed, whichever spelling it arrives in. Prefixing it makes a
  phase that never ends.
- The three tests that asserted a throwing phase's retire (`updateStatus`,
  `withProgress`, phase nesting) now assert the flag beside the same label.
  `progress.test.ts`'s randomized stream property test mixes failed retires into
  its generated phases and still asserts no emitted fraction overshoots.
- `statusReading` replaces the `typeof status === 'object'` narrowing at the four
  places inside `progress.ts` that read `current`/`total`, plus the desktop job
  card's byte counts.
- The credit only matters where a slot's finished work outlives the failure —
  a fan-out, whose slots are never reclaimed. A window slot is removed by the
  operation's own `clear`, which takes its `completed` with it.

## Revisit if

- A failure needs to say more than "it did not finish" — a cancel distinguished
  from an error, say, so the UI can style them differently. That is another field
  on `PhaseFailure`, not another channel.
- The forward step on failure reads badly. The fix is the held alternative above,
  in `completed`, not a clamp on the arithmetic.
