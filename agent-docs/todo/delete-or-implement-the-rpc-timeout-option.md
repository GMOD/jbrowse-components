---
name: delete-or-implement-the-rpc-timeout-option
description: delete half done; the implement half goes in `RpcHandles`
metadata:
  area: RPC
  category: ready
---

# Delete or implement the RPC `timeout` option

**The delete half is done, and the position it rode in is gone too.**
`loadRefNameMap`'s `{ timeout: 1000000 }` went first, as an option nothing read:
the old `BaseRpcDriver.transport` spread an `options` bag into `worker.call`,
which destructured `statusCallback` and nothing else, so there was no timeout
mechanism anywhere in `packages/core/src/rpc/`. That bag has since been removed
outright — the handles ride `args`, one position each — so there is no longer
even a place to pass an inert option. The entry earned a
line because the option sat next to a carefully argued comment about
deliberately *not* passing a stop token, which made the surrounding code read as
though a bound existed.

What is left is the implement half, and it is now the sharper of the two:
`RemoteFileWithRangeCache` has a per-request deadline
(`@gmod/range-cache-filehandle`'s `RESPONSE_TIMEOUT_MS`) and the RPC layer has
none, so the same question is answered two ways at two
layers. Copy the shape rather than inventing one — it bounds the wait for a
*response*, not the transfer, and composes with the caller's signal instead of
replacing it.

**It goes in `RpcHandles`, beside the stop token, not in any registry entry.** A
timeout is a property of the call — every method can be bounded — which is the
same test `stopToken` and `statusCallback` each failed on their first attempt,
each by landing in one method's `args` and thereby being unpassable to the other
forty. `EntriesDeclaringCallLevelFields` in `RpcRegistry.ts` now fails
compilation naming the entry that tries it, so the wrong version of this is a
build error rather than a third repetition.
