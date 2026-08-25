import {
  createStopToken,
  stopStopToken,
  stopTokenSignal,
} from '../util/stopToken.ts'

import type { StopToken } from '../util/stopToken.ts'

export interface CallDeadline {
  /** what to send over the wire in place of the caller's token */
  stopToken: StopToken
  /** rejects when the deadline fires; never resolves */
  expiry: Promise<never>
  /** stop the clock; call as soon as the call settles */
  settled: () => void
  /** unlink from the caller's token and release ours; call once the call is over */
  dispose: () => void
}

/**
 * A bound on how long one RPC call may take, composed with the caller's stop
 * token rather than replacing it.
 *
 * **There is no default, and that is the design rather than an omission.** The
 * shape is `@gmod/range-cache-filehandle`'s `RESPONSE_TIMEOUT_MS`, whose whole
 * point is that it bounds the wait for a *response* and not the transfer —
 * a deadline over the bytes would cut a large read off on a slow link, turning
 * a slow session into a broken one. An RPC has no such seam to put a deadline
 * behind: the reply IS the work, so a blanket bound would do exactly what that
 * one refuses to. What a caller knows and this layer does not is whether its
 * own method has a bound worth stating, so the bound is per-call and opt-in,
 * the way {@link StopToken} is.
 *
 * **The caller's token is composed, never replaced.** The wire carries one
 * token per call, so a deadline cannot ride alongside the caller's — it mints
 * its own and forwards the caller's stop into it. Sending the deadline's token
 * *instead* would silently take cancellation away from the caller: a superseded
 * fetch stops its token, the worker would never hear about it, and the read
 * would run to completion behind a result nobody wants.
 *
 * **Expiry both rejects and stops.** Rejecting alone abandons the promise while
 * the worker grinds on — a wedged call would keep its pool slot and its CPU
 * with nothing left to deliver to. Stopping alone settles nothing: a worker
 * spinning without yielding never reads the stop, which is the failure a
 * deadline exists for in the first place.
 *
 * The order inside the timer is what decides which of the two a caller reads,
 * and it is deliberate: {@link CallDeadline.expiry} rejects synchronously with
 * the timer, so it wins the race against a cooperative worker's abort even
 * though that abort was provoked by the stop one line above. The caller gets
 * "did not finish in time" rather than a bare AbortError, which is the useful
 * half. Nothing downstream re-inspects the rejection to prefer one over the
 * other; there is no window in which it would fire.
 *
 * Two disposers, for the reason `withResponseDeadline` has two:
 * {@link CallDeadline.settled} stops the clock the moment a reply lands, while
 * {@link CallDeadline.dispose} cannot run until the call is over, since it
 * unlinks the caller's stop from the token the worker is watching.
 *
 * `describe` is a thunk so nothing builds the message unless the deadline fires.
 */
export function withCallDeadline(
  timeout: number,
  callerToken: StopToken | undefined,
  describe: () => string,
): CallDeadline {
  const own = createStopToken()
  const { signal, dispose: unlink } = stopTokenSignal(callerToken)
  const onCallerStop = () => {
    stopStopToken(own)
    // Stand the deadline down with it. Once the caller has given up there is
    // nothing left for it to diagnose, and a call that never settles would
    // otherwise fire the timer later and report a cancelled call as one that
    // ran out of time.
    deadline.settled()
  }
  let rejectExpiry: (e: Error) => void = () => {}
  const deadline: CallDeadline = {
    stopToken: own,
    // Constructed eagerly and never resolved, so the race below has something
    // to lose to. Given a rejection handler at once — an unhandled rejection
    // is reported whether or not anyone is racing it yet.
    expiry: new Promise<never>((_resolve, reject) => {
      rejectExpiry = reject
    }),
    settled: () => {
      clearTimeout(timer)
    },
    dispose: () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onCallerStop)
      unlink()
      // the deadline's token ends with the call whichever way it went; an
      // unstopped one pins the signal controllers taken against it
      stopStopToken(own)
    },
  }
  deadline.expiry.catch(() => {})
  // Before the aborted check below, which calls `settled()` and so reads this.
  // An already-stopped caller is the ordinary case for a superseded fetch, not
  // a rare one, and reading `timer` in its temporal dead zone would throw from
  // the one path that has nothing left to report the throw to.
  const timer = setTimeout(() => {
    stopStopToken(own)
    rejectExpiry(new Error(describe()))
  }, timeout)
  if (signal.aborted) {
    onCallerStop()
  } else {
    signal.addEventListener('abort', onCallerStop)
  }
  return deadline
}
