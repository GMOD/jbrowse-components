import { createStatusChannel } from '@jbrowse/core/util'
import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'

import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * #stateModel DiagonalizeProgressMixin
 * #category view
 *
 * The auto-diagonalize lifecycle state shared by the comparative views
 * (LinearSyntenyView, DotplotView): the in-flight wait, its live RPC status and
 * stop token, and the flag that gates `settled` so a screenshot or browser test
 * can't capture a pre-reorder hairball.
 *
 * `withDiagonalizeProgress` drives the wait and the status/token pair; the gate
 * is raised and lowered by the view's own init autorun, which is the only thing
 * that knows a reorder was asked for. Composed rather than duplicated so both
 * views report progress, cancel, and gate identically.
 */
export function DiagonalizeProgressMixin() {
  return types
    .model('DiagonalizeProgress', {})
    .volatile(() => ({
      /**
       * #volatile
       * True while the init autorun is waiting on the diagonalize RPC. Gates the
       * canvas off — otherwise the user watches an undiagonalized hairball flash
       * before the reorder kicks in.
       */
      awaitingAutoDiagonalize: false,
      /**
       * #volatile
       * A reorder this init asked for that has not succeeded yet. Raised before
       * any render can paint, and lowered only once the pass RESOLVES — a
       * skipped or thrown reorder leaves it up, so the view's `settled` gate
       * never reports done on an undiagonalized view and the capture fails
       * loudly (times out) instead of committing a hairball.
       *
       * One flag rather than a requested/complete pair: the two only ever moved
       * together, and every state a pair can drift into either wedges the gate
       * shut or opens it on the wrong pass.
       */
      pendingAutoDiagonalize: false,
      /**
       * #volatile
       * Live status from the auto-diagonalize RPC (download %, parse, algorithm
       * phase) shown on the reordering spinner; blank outside that wait.
       *
       * A `StatusChannel` rather than a status field plus a setter: there is one
       * operation to narrate here, and the channel is that pair with the
       * message/fraction split already done, so the spinner reads
       * `{ message, fraction }` instead of calling `statusMessageText` /
       * `statusFraction` at every render site.
       */
      diagonalizeStatus: createStatusChannel(),
      /**
       * #volatile
       * Stop token for the in-flight auto-diagonalize, so the spinner's Cancel
       * can abort it; undefined when none is running.
       */
      diagonalizeStopToken: undefined as StopToken | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setAwaitingAutoDiagonalize(arg: boolean) {
        self.awaitingAutoDiagonalize = arg
      },
      /**
       * #action
       * Declare the gate at the top of one init apply pass: a reorder is
       * pending iff THIS init asked for one. Assigning rather than raising is
       * what hands the gate over cleanly — a superseded init that asked for a
       * reorder and then skipped it would otherwise leave the flag up with
       * nothing coming, wedging `settled` forever.
       */
      beginAutoDiagonalize(requested: boolean) {
        self.pendingAutoDiagonalize = requested
      },
      /**
       * #action
       * The init-time reorder resolved, so the view on screen is the
       * diagonalized one — open the gate.
       */
      finishAutoDiagonalize() {
        self.pendingAutoDiagonalize = false
      },
      /**
       * #action
       */
      setDiagonalizeStopToken(arg?: StopToken) {
        self.diagonalizeStopToken = arg
      },
      /**
       * #action
       * Abort an in-flight auto-diagonalize; `withDiagonalizeProgress`'s finally
       * clears the wait flag, revealing the (undiagonalized) view.
       *
       * Lowers the gate too. The abort reaches the caller as a throw, which
       * skips its `finishAutoDiagonalize()` — right for a reorder that failed
       * on its own (`settled` stays false and a capture times out loudly rather
       * than committing a hairball), wrong for one the user stopped: cancelling
       * IS the user settling for this view, and a gate nothing will lower again
       * leaves `settled` false forever.
       */
      cancelAutoDiagonalize() {
        stopStopToken(self.diagonalizeStopToken)
        self.pendingAutoDiagonalize = false
      },
    }))
}
