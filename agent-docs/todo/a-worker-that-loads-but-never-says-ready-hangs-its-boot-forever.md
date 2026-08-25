---
name: a-worker-that-loads-but-never-says-ready-hangs-its-boot-forever
description: the boot handshake has no deadline, so a worker that loads and goes quiet hangs every call behind it
metadata:
  area: RPC
  category: ready
---

# A worker that loads but never says `ready` hangs its boot forever

`WebWorkerRpcDriver.makeWorker` resolves on the worker posting `ready` and
rejects on an `ErrorEvent`, which covers a script that *throws* while loading.
What neither covers is a script that loads, starts, and then goes quiet — a
module-level import that never settles, a `receiveConfiguration()` waiting on a
`config` message the main thread failed to send in a way that raised nothing.
The promise never settles, `LazyWorker.bootP` never clears, and every call
routed to that slot waits behind it with no error anywhere. The file already
half-knows: the `readyForConfig` branch carries the comment "The worker is
waiting in receiveConfiguration(), which has no timeout".

This is the RPC layer's version of the failure `RESPONSE_TIMEOUT_MS` exists for
— an open channel with nothing coming back, which produces no error at all
because from the caller's side something really is in flight.

**Unlike a call, a boot SHOULD have a default bound**, and that is what makes
this the good first user of the mechanism rather than a repeat of it. The
argument against a default on a call is that the reply is the work, so no number
is right for every method. A handshake is not work: it is two messages, it is
the same two messages every time, and a worker that has not sent `ready` in
thirty seconds is not about to.

**First move: `withCallDeadline` is not quite the shape.** It exists to compose
with a caller's stop token and mint a wire token, and a boot has neither — it
wants the timer and the thunked message and nothing else. Pull that half out
rather than passing a boot a token it will not use, and reject through the
existing `fail()`, which already terminates the half-booted worker so the pool
re-boots the slot instead of orphaning a thread.
