---
name: a-timeout-on-an-rpc-call-and-a-deadline-on
description: A `timeout` on an RPC call, and a deadline on the worker boot handshake
area: performance-and-measurement
---

# A `timeout` on an RPC call, and a deadline on the worker boot handshake

—
built 2026-08-25 and reverted the same day. The mechanism worked and the
design questions it settled were the real ones: no default is possible,
because an RPC's reply IS its work and a blanket deadline is the same mistake
as bounding a range read's transfer rather than its response; and a deadline
cannot ride beside the caller's stop token, since the wire carries one per
call, so it has to mint its own and forward the caller's stop into it. What
none of that survives is **who is waiting**. This is a browser app, so the
user's recovery — close the tab, reload — is faster and more reliable than any
deadline, and it is what they already do. A server has to bound a wait because
nobody is watching; a page does not. That leaves an opt-in mechanism with no
callers paying maintenance surface in `BaseRpcDriver` for a failure someone
else fixes in two seconds.

The concrete hang it was aimed at is real and still there:
`WebWorkerRpcDriver.makeWorker` resolves on `ready` and rejects on an
`ErrorEvent`, so a worker that loads and then goes quiet (a module import that
never settles) hangs its boot promise and every call routed behind it. Judged
not worth a mechanism — it needs a bug nobody has hit, and the reload clears
it. **Reopen only if** it is reported, or if a non-browser consumer (a node
embedder, a CI harness) grows where no one is at the keyboard.
