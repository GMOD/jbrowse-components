import { waitFor } from '@testing-library/react'
import { spy } from 'mobx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// A row whose debounced window is behind its live one, which is the 500ms
// `LGVCoarseDynamicBlocks` autorun still owing a run. `setCoarseDynamicBlocks`
// compares block keys and bpPerPx and assigns only on a difference, so equality
// here is exactly "that autorun has run for the viewport as it stands".
function debouncePending(lgv: LinearGenomeViewModel) {
  const keys = (blocks: { key: string }[]) => blocks.map(b => b.key).join(',')
  return (
    lgv.initialized &&
    (lgv.coarseBpPerPx !== lgv.bpPerPx ||
      keys(lgv.coarseDynamicBlocks) !== keys(lgv.dynamicBlocks.contentBlocks))
  )
}

/**
 * Every pass the last move woke, run to a stop — what the fixed sleeps in the
 * follow suites used to approximate.
 *
 * The exact pass is the `SyntenyFollow` autorun. Two things wake it: the coarse
 * blocks, which a 500ms-debounced autorun writes and every discrete placement
 * flushes, and its own answer landing, since applying one navigates a row. So
 * it is done when no row's debounce is outstanding and the autorun has stopped
 * running — a signal that says the pass ran, where a sleep only ever said time
 * passed, and one that costs the convergence rather than the guess.
 *
 * `quietMs` has to outlast the resolve's RPC round trip, which on the main
 * thread driver is a promise chain over an adapter the suite has already
 * warmed. On the deadline it returns rather than throwing: a follow that never
 * quiets is what "holds the row rather than spinning" is about, and the test's
 * own assertions are the verdict on it.
 */
export async function followSettled(
  views: LinearGenomeViewModel[],
  { quietMs = 150, deadlineMs = 10_000 } = {},
) {
  let runs = 0
  const dispose = spy(ev => {
    if (ev.type === 'reaction' && ev.name === 'SyntenyFollow') {
      runs++
    }
  })
  try {
    const deadline = Date.now() + deadlineMs
    for (;;) {
      await waitFor(
        () => {
          expect(views.some(debouncePending)).toBe(false)
        },
        { timeout: Math.max(deadline - Date.now(), 100) },
      )
      const before = runs
      await new Promise(resolve => setTimeout(resolve, quietMs))
      if (
        (runs === before && !views.some(debouncePending)) ||
        Date.now() > deadline
      ) {
        return
      }
    }
  } finally {
    dispose()
  }
}
