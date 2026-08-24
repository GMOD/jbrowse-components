import { useState } from 'react'

import { statusMessageText, updateStatus } from '@jbrowse/core/util/progress'
import { useEventCallback } from '@jbrowse/core/util/useEventCallback'

import type { RpcStatus } from '@jbrowse/core/util/progress'

/**
 * A status label for an imperative user action — opening a genome, launching a
 * session, building an index — held in component state.
 *
 * ```ts
 * const { status, updateStatus } = useUpdateStatus()
 * await updateStatus('Loading session', async () => { ... })
 * ```
 *
 * The point is that no call site writes the clear. Every hand-rolled version of
 * this in the tree was a `setStatus(label)` and a `setStatus('')` in a `finally`
 * — a pair that has to be kept together through every early exit and every
 * throw, and whose failure mode is a label that never goes away, over a dialog
 * that looks hung.
 *
 * Delegates to core's {@link updateStatus} rather than reimplementing it, which
 * is what makes nested calls behave: an inner phase's end restores the label its
 * caller set instead of blanking it, and a phase that throws retires like one
 * that returned. `status` is `undefined` when nothing is running, so it reads
 * directly as the "is anything in flight" test the callers already do.
 *
 * NOT a data-fetching hook. `useFetch` is the one that owns a key, refetches
 * when it changes, and caches — this owns nothing and runs when it is called.
 */
export function useUpdateStatus() {
  const [status, setStatus] = useState<RpcStatus>('')
  // stable identity, because core keys the open-phase stack on this callback
  const report = useEventCallback((next: RpcStatus) => {
    setStatus(next)
  })
  function runUnderStatus<T>(label: string, fn: () => T | Promise<T>) {
    return updateStatus(label, report, fn)
  }
  return { status: statusMessageText(status), updateStatus: runUnderStatus }
}
