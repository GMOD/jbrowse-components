import { stopStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'

import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

/**
 * #stateModel DiagonalizeProgressMixin
 * #category view
 *
 * The auto-diagonalize lifecycle state shared by the comparative views
 * (LinearSyntenyView, DotplotView): the in-flight wait, its live RPC status and
 * stop token, and the two flags that gate `settled` so a screenshot or browser
 * test can't capture a pre-reorder hairball.
 *
 * `withDiagonalizeProgress` drives the first three; the requested/complete pair
 * is set by the view's own init autorun, which is the only thing that knows a
 * reorder was asked for. Composed rather than duplicated so both views report
 * progress, cancel, and gate identically.
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
       * Set true as soon as an init-time autoDiagonalize is requested, before any
       * render can paint. Gates `diagonalizeSettled` so a capture can't commit
       * the pre-reorder view during the view-building await window, before
       * `awaitingAutoDiagonalize` flips.
       */
      autoDiagonalizeRequested: false,
      /**
       * #volatile
       * Set true only after the init-time diagonalize pass RESOLVES
       * successfully. If the reorder is skipped or throws this stays false, so
       * `diagonalizeSettled` never reports done on an undiagonalized view — the
       * capture fails loudly (times out) instead of committing a hairball.
       */
      autoDiagonalizeComplete: false,
      /**
       * #volatile
       * Live status from the auto-diagonalize RPC (download %, parse, algorithm
       * phase) shown on the reordering spinner; undefined outside that wait.
       */
      diagonalizeStatus: undefined as RpcStatus | undefined,
      /**
       * #volatile
       * Stop token for the in-flight auto-diagonalize, so the spinner's Cancel
       * can abort it; undefined when none is running.
       */
      diagonalizeStopToken: undefined as StopToken | undefined,
    }))
    .views(self => ({
      /**
       * #getter
       * The diagonalize half of a view's `settled` gate: either no reorder was
       * requested, or the one that was has completed.
       */
      get diagonalizeSettled() {
        return !self.autoDiagonalizeRequested || self.autoDiagonalizeComplete
      },
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
       * Re-declare the gate at the top of one init apply pass: a reorder is
       * pending iff THIS init asked for one, and nothing is complete until this
       * pass completes it.
       *
       * The pair has to move together, which is why this is one action rather
       * than two setters. A superseded init that set `requested` and then
       * skipped its reorder would otherwise leave the flag true with nothing
       * coming, wedging `diagonalizeSettled` (and so `settled`) forever; and a
       * previous init's `complete` would satisfy the gate for the next one's
       * un-reordered view, which is the same capture bug the flags exist to
       * prevent, in the other direction.
       */
      beginAutoDiagonalize(requested: boolean) {
        self.autoDiagonalizeRequested = requested
        self.autoDiagonalizeComplete = false
      },
      /**
       * #action
       */
      setAutoDiagonalizeComplete(arg: boolean) {
        self.autoDiagonalizeComplete = arg
      },
      /**
       * #action
       */
      setDiagonalizeStatus(arg?: RpcStatus) {
        self.diagonalizeStatus = arg
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
       */
      cancelAutoDiagonalize() {
        stopStopToken(self.diagonalizeStopToken)
      },
    }))
}
