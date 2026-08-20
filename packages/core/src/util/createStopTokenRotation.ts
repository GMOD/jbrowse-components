import { isAlive } from '@jbrowse/mobx-state-tree'
import { observable, runInAction } from 'mobx'

import {
  createStatusWindow,
  statusFraction,
  statusMessageText,
} from './progress.ts'
import { createStopToken, stopStopToken } from './stopToken.ts'

import type { RpcStatus, StatusWindow } from './progress.ts'
import type { StopToken } from './stopToken.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface StatusReporter {
  setStatusMessage: (status?: RpcStatus) => void
  /**
   * The host's own window, present on any display composing the LGV fetch
   * mixins. When it is, the rotation reports and flushes through it rather than
   * opening a SECOND on the same status field — which is the thing
   * one-window-per-owner exists to prevent, and which the multi-sample-variant
   * sources fetch had done to a display whose region fetches were already
   * thinning through the mixin's.
   *
   * Lent whole rather than as the two callbacks it used to be. Reporting
   * through one window and flushing another is a state nobody would choose, and
   * as two independently-optional members it was one a caller could reach by
   * supplying half.
   *
   * Optional because the displays this helper was written for (dotplot,
   * synteny) compose no fetch mixin; the rotation opens its own for them.
   */
  statusWindow?: StatusWindow
}

/**
 * A {@link StatusReporter} a model can hold in **one** volatile, for something
 * that has one operation to narrate and no reason to grow a status vocabulary
 * of its own.
 *
 * The alternative is what every display does: two volatiles and an action that
 * calls {@link statusMessageText} and {@link statusFraction}. That is the right
 * shape where the fields are part of the model's own surface — `BaseDisplay`
 * and `FetchMixin` declare them because half the display API reads them, and
 * ADR-041 is why those two keep their own copies rather than sharing a mixin.
 * It is a lot of declaration for a view that wants a corner chip while one
 * fetch runs.
 *
 * A plain function rather than a mixin, for the reason ADR-041 gives: a compose
 * layer is what the model chains here cannot afford. Holding it costs one
 * `.volatile` line, and `ProgressChip` takes `message`/`fraction` straight off
 * it.
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
   * Call in the `finally` of the run that owns this fetch: closes
   * `isCurrent`, drops the write queued behind the window, and clears the
   * status field.
   *
   * All three, because a caller doing it by hand got some subset. `isCurrent`
   * is `token === current && isAlive`, and a run that *completes* never rotates
   * its own token — so the guard stays open after the work ends and a trailing
   * write lands on top of a hand-written `setStatusMessage(undefined)` up to a
   * window later. That is the shape `installComparativeFetchAutorun` had; the
   * multi-sample-variant sources fetch had no clear at all and pinned a
   * progress chip on any failure its worker didn't clear for it.
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
 * `end()` in the run's `finally` is the other half, and for the same reason:
 * ending a fetch means three things (close the guard, drop the window's queued
 * write, clear the status field) and a caller writing them out got a subset. Both callers did — one cleared without dropping the queued write,
 * the other never cleared at all.
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
  // one window rather than two writing one field; our own otherwise. Reopened
  // per fetch so each new fetch reports its first status immediately — without
  // that these displays wrote an observable per progress event where every
  // mixin-based display thins to 10/s, and the overlay repainted faster than the
  // view animated.
  const statusWindow = report.statusWindow ?? createStatusWindow()
  const clearStatus = () => {
    statusWindow.flush(() => {
      if (isAlive(self)) {
        report.setStatusMessage(undefined)
      }
    })
  }
  return {
    begin(): ActiveFetch {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      const stopToken = createStopToken()
      currentStopToken = stopToken
      // The window reopens; the label is deliberately left alone. A fetch being
      // SUPERSEDED is the one case where the display does not stop loading, and
      // the loading overlay renders a missing label as its `'Loading'` fallback
      // — so clearing here flashed "Loading" between every pan and the phase the
      // view was already in. The replacing fetch overwrites the label as soon as
      // it has one of its own, and `end()` still clears on the fetch that
      // actually stops. ADR-080; `FetchMixin.supersedeStatus` is the same
      // decision for the LGV displays.
      statusWindow.reset()
      // `ended` is the term a completed fetch has no other way to express: a
      // SUPERSEDED one is caught by the token comparison, but a fetch that
      // simply finished still holds the current token, so without this its
      // guard stays open and a trailing status write lands after the run that
      // owned it is over. Read by the sink as well as by the caller's commit
      // guard, which is why both go through this one closure.
      let ended = false
      const isCurrent = () =>
        !ended && stopToken === currentStopToken && isAlive(self)
      return {
        stopToken,
        isCurrent,
        statusCallback: statusWindow.sink({
          isCurrent,
          write: status => {
            report.setStatusMessage(status)
          },
        }),
        end() {
          // Only the run that still owns the field clears it. A SUPERSEDED run
          // reaches its `finally` too — it unwinds on the abort the rotation
          // just raised — and clearing there would wipe the label the fetch
          // that replaced it has already set.
          const owned = isCurrent()
          ended = true
          if (owned) {
            clearStatus()
          }
        },
      }
    },
    dispose() {
      if (currentStopToken) {
        stopStopToken(currentStopToken)
      }
      // the window outlives the token: a trailing write is queued on a timer,
      // and while the sink's `isCurrent` makes it a no-op rather than a write to
      // a dead node, the timer itself still stands for up to a window past
      // teardown. `FetchMixin.resetStatus` resets for the same reason.
      statusWindow.reset()
    },
  }
}
