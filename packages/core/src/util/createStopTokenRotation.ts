import { isAlive } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import {
  createStatusWindow,
  statusFraction,
  statusMessageText,
} from './progress.ts'
import { createStopToken, stopStopToken } from './stopToken.ts'

import type { RpcStatus, StatusStream, StatusWindow } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface StatusReporter {
  setStatusMessage: (status?: RpcStatus) => void
  /**
   * The host's own window, present on any display composing the LGV fetch
   * mixins. When it is, the rotation reports through it rather than opening a
   * SECOND on the same status field — which is what one-window-per-owner exists
   * to prevent.
   *
   * Optional because the displays this helper was written for (dotplot,
   * synteny) compose no fetch mixin; the rotation opens its own for them.
   */
  statusWindow?: StatusWindow
}

/**
 * A {@link StatusReporter} a model can hold in **one** volatile, for something
 * that has one operation to narrate and no reason to grow a status vocabulary
 * of its own. `ProgressChip` takes `message`/`fraction` straight off it.
 *
 * The alternative is what every display does: two volatiles and an action
 * calling {@link statusMessageText} and {@link statusFraction}. That is the
 * right shape where the fields are part of the model's own surface —
 * `BaseDisplay` and `FetchMixin` declare them because half the display API reads
 * them — and a lot of declaration for a view that wants a corner chip while one
 * fetch runs. A plain function rather than a mixin because a compose layer is
 * what the model chains here cannot afford (ADR-041).
 */
export interface StatusChannel extends StatusReporter {
  readonly message: string | undefined
  readonly fraction: number | undefined
}

export function createStatusChannel(): StatusChannel {
  // MobX rather than MST, so this is a value a model can hold rather than a
  // node it has to parent. A volatile is `observable.ref`, so the fields have
  // to be observable in their own right for a component to see them move.
  const state = observable(
    {
      message: undefined as string | undefined,
      fraction: undefined as number | undefined,
    },
    {},
    { deep: false },
  )
  return {
    get message() {
      return state.message
    },
    get fraction() {
      return state.fraction
    },
    setStatusMessage(status?: RpcStatus) {
      // its own action: the rotation calls this from a status callback, which
      // fires after an await and so outside whatever MST action started the
      // fetch
      runInAction(() => {
        state.message = statusMessageText(status)
        state.fraction = statusFraction(status)
      })
    },
  }
}

export interface ActiveFetch {
  /** stop token to forward to the RPC call */
  stopToken: StopToken
  /**
   * True only while this is still the most recent fetch AND `self` is alive.
   * Gate every post-await write — result commit, error set — on it so a
   * superseded or torn-down fetch never writes back.
   */
  isCurrent: () => boolean
  /**
   * RPC `statusCallback` pre-gated by `isCurrent`: forwards progress to
   * `setStatusMessage` only while this is still the latest fetch, so a
   * superseded fetch's late status update can't flicker the overlay, and
   * throttled to the same leading edge as `FetchMixin`'s callbacks. Pass it
   * straight as the RPC `statusCallback` arg.
   */
  statusCallback: (status: RpcStatus) => void
  /**
   * Call in the `finally` of the run that owns this fetch: closes `isCurrent`
   * and retires this fetch's status slot, which blanks the field only if no
   * other operation on the host is still reporting.
   *
   * Both together, because a caller doing it by hand gets a subset.
   * `isCurrent` is `token === current && isAlive`, and a run that *completes*
   * never rotates its own token — so without this the guard stays open past the
   * work and a trailing write lands on top of a hand-written
   * `setStatusMessage(undefined)` up to a window later.
   *
   * A **superseded** run calls it too, and must: its slot goes on voting for a
   * phase that is over until it does. The run that replaced it has already
   * opened its own slot by then, so the label the user is looking at survives.
   */
  end: () => void
}

/**
 * Latest-wins stop-token rotation for a fetch that runs in a bare `autorun`
 * rather than through `FetchMixin.runFetch` (which welds the same mechanics to
 * `fetchGeneration`, so it's only for viewport-driven LGV fetches). Each
 * `begin()` aborts the prior fetch's token and returns a fresh one plus an
 * `isCurrent()` guard that captures this run's token — gate every post-await
 * write on it and a superseded or torn-down fetch can never clobber fresher
 * data. The guard is the return value, so a caller can't forget to compare a
 * token by hand.
 *
 * `end()` in the run's `finally` is the other half, and for the same reason —
 * see {@link ActiveFetch.end} for the two things it does together.
 *
 * Owns the token mechanics and the status channel; the caller keeps its own
 * loading/error/commit side-effects in its autorun. Used by any bare-autorun
 * fetch: the comparative-view displays (dotplot, synteny, through
 * `installComparativeFetchAutorun`, which wraps this with their shared
 * debounce/flags/commit skeleton), the multi-sample-variant sources fetch, and
 * the breakpoint split view's overlay-feature fetch.
 *
 * `report` is passed rather than read off `self`, so where the status lands is
 * the caller's decision and not a shape this imposes. A display passes itself —
 * its status fields are part of its own API, and one composing `FetchMixin`
 * passes the model-wide window along with them (see `StatusReporter`).
 * Anything with one operation to narrate and no status vocabulary of its own
 * passes a {@link createStatusChannel}, which is one volatile instead of two
 * fields and an action.
 */
export function createStopTokenRotation(
  self: IStateTreeNode,
  report: StatusReporter,
) {
  let currentStopToken: StopToken | undefined
  // The host's window when it has one, so a display composing `FetchMixin` has
  // one window rather than two writing one field; our own otherwise. Lent means
  // this fetch is one slot beside the host's others rather than a second writer
  // (ADR-081), which is why `end()` no longer has to ask whether it owns the
  // field.
  const lent = report.statusWindow !== undefined
  const statusWindow =
    report.statusWindow ??
    // the one place the field is touched, so the liveness check covers a
    // stream's statuses and the clear that ends it alike
    createStatusWindow((status: RpcStatus | undefined) => {
      if (isAlive(self)) {
        report.setStatusMessage(status)
      }
    })
  let openStream: StatusStream | undefined
  return {
    begin(): ActiveFetch {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      const stopToken = createStopToken()
      currentStopToken = stopToken
      // `ended` is the term a completed fetch has no other way to express: the
      // token comparison catches a SUPERSEDED one, but a fetch that simply
      // finished still holds the current token. The stream reads it as well as
      // the caller's commit guard, which is why both go through this closure.
      let ended = false
      const isCurrent = () =>
        !ended && stopToken === currentStopToken && isAlive(self)
      // Opened BEFORE the superseded run reaches its `finally`, which is what
      // keeps the label the user is looking at from blanking between the two:
      // the run being replaced is suspended at an await and resumes a microtask
      // from now, by which point this slot is already voting. A fetch being
      // SUPERSEDED is the one case where the display does not stop loading, so
      // a gap there reads as the overlay's `'Loading'` fallback (ADR-080).
      const stream = statusWindow.open({ isCurrent })
      openStream = stream
      return {
        stopToken,
        isCurrent,
        statusCallback: stream.statusCallback,
        end() {
          ended = true
          if (openStream === stream) {
            openStream = undefined
          }
          stream.clear()
        },
      }
    },
    dispose() {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      // a fetch in flight when the host is torn down never reaches its
      // `finally`, and a slot nobody retires goes on voting
      openStream?.clear()
      openStream = undefined
      // the window outlives the token: a trailing write is queued on a timer,
      // and while the sink's `isCurrent` makes it a no-op rather than a write to
      // a dead node, the timer itself still stands for up to a window past
      // teardown. Only ours — resetting a lent one drops a write the host's
      // other operations are still owed.
      if (!lent) {
        statusWindow.reset()
      }
    },
  }
}
