import {
  checkStopTokenThrottled,
  createStopTokenChecker,
  withStopTokenCheck,
} from './stopToken.ts'
import { createTimeGate } from './timeGate.ts'

import type { StopToken, StopTokenChecker } from './stopToken.ts'

// The phases currently open on one status channel, keyed by the callback that
// *is* that channel. Entries are objects rather than strings so a phase removes
// its own on the way out by identity: two phases running concurrently on one
// callback (a `Promise.all` handed the same one) finish in either order, and a
// LIFO pop would retire the wrong one.
//
// A WeakMap, so a channel that goes away takes its stack with it, and a caller
// that builds a fresh callback per call simply gets a fresh stack — which is
// the pre-stack behavior, not a regression.
interface OpenPhase {
  label: string
}
const openPhases = new WeakMap<StatusCallback, OpenPhase[]>()

/**
 * Open a phase on `cb`'s channel and return its close. The close emits the
 * enclosing phase's label, or `''` when this was the outermost — which is what
 * makes phases nest.
 *
 * They used to not: the clear was absolute, so an inner phase blanked the label
 * its caller had set for the whole rest of the caller's work, and the rule was
 * "run phases in sequence, or give the inner one no `statusCallback`". That is a
 * rule about code you cannot see from the call site — `cachedSetup` wrapping a
 * `setup` that reaches `fetchAndMaybeUnzip` is two files apart — so it was a
 * rule waiting to be broken rather than one anybody could follow.
 *
 * `''` still closes the outermost phase, so nothing downstream changes: it is
 * how every consumer already reads "this phase is over", it is what a
 * {@link StatusWindow} sink thins like any other status, and it is what
 * {@link aggregateStatus} reads as "not in flight".
 */
function openPhase(cb: StatusCallback | undefined, label: string) {
  if (cb === undefined) {
    return () => {}
  }
  let stack = openPhases.get(cb)
  if (stack === undefined) {
    stack = []
    openPhases.set(cb, stack)
  }
  const phase: OpenPhase = { label }
  stack.push(phase)
  return () => {
    const index = stack.lastIndexOf(phase)
    if (index !== -1) {
      stack.splice(index, 1)
    }
    cb(stack.at(-1)?.label ?? '')
  }
}

/**
 * Indeterminate phase: set `label` on the status channel, run `fn`, then restore
 * whatever phase encloses it — `''` when there is none. Pass `stopToken` and the
 * phase becomes a cancellation boundary too: this is the labelled form of
 * {@link withStopTokenCheck}, so `fn` is checked on both sides of its await and
 * neither check has to be remembered at the call site. The determinate
 * counterpart is {@link withProgress}.
 *
 * Nests, and see {@link openPhase} for what that replaced. An inner phase's
 * determinate bar is not restored with its caller's label, only the label — the
 * enclosing phase's next `report()` re-establishes it, and an enclosing phase
 * that has none to send was indeterminate anyway.
 */
export async function updateStatus<U>(
  msg: string,
  cb: StatusCallback | undefined,
  fn: () => U | Promise<U>,
  stopToken?: StopToken,
) {
  const endPhase = openPhase(cb, msg)
  cb?.(msg)
  // finally, so a throwing `fn` doesn't leave its phase label sitting on the
  // channel forever — the error surfaces under a stale "Downloading file"
  try {
    return await withStopTokenCheck(stopToken, fn)
  } finally {
    endPhase()
  }
}

/**
 * A value flowing through the RPC `statusCallback` channel.
 *
 * Historically this was always a plain human-readable string (e.g. "Loading
 * features"). It may now also carry determinate progress, which the loading UI
 * renders as a progress bar in addition to the message. Plain strings remain
 * valid for indeterminate phases, so existing callers are unaffected.
 */
export interface StatusWithProgress {
  message: string
  current: number
  total: number
}

export type RpcStatus = string | StatusWithProgress

/**
 * The single out-of-band status transport carried across the RPC boundary. A
 * plain string is an indeterminate phase label; a {@link StatusWithProgress}
 * adds a determinate fraction. Adapters wrap raw byte/block/feature counts into
 * this; the loading UI renders the message and (when present) a progress bar.
 */
export type StatusCallback = (status: RpcStatus) => void

/**
 * The phase a status names, verbatim — its label, whichever shape it arrived in.
 * The raw form, `''` and all, for the two places that have to reason about the
 * sentinel itself. Everywhere else wants {@link statusMessageText}.
 */
function phaseOf(status: RpcStatus) {
  return typeof status === 'object' ? status.message : status
}

/**
 * Extract the human-readable text from any status value, or `undefined` when
 * there is none.
 *
 * `''` is none: it is the phase-over sentinel, not a label. Passing it through
 * as an empty string gave every model that stores a `statusMessage` two spellings
 * of "nothing to show" — `undefined` from a reset, `''` from the last phase
 * ending — which read the same on screen (`message || 'Loading'`) and differently
 * to everything else. Normalizing here covers all three writers, which are the
 * same line of code (`assembly`, `BaseDisplayModel`, `FetchMixin`).
 */
export function statusMessageText(status: RpcStatus | undefined) {
  const text = status === undefined ? undefined : phaseOf(status)
  return text === '' ? undefined : text
}

/**
 * Fraction complete in [0,1], or undefined when the status is indeterminate
 * (a plain string, or a zero total).
 */
export function statusFraction(status: RpcStatus | undefined) {
  return typeof status === 'object' && status.total > 0
    ? Math.min(1, status.current / status.total)
    : undefined
}

/**
 * One owner's outlet for a progress stream: a throttle window, and the guarded
 * callbacks that share it.
 *
 * The two are one object because they were never separable. Every owner of a
 * status field wants the same pair — thin the stream, and drop what a
 * superseded or torn-down operation writes — and the pairing carries a
 * cardinality rule that two functions could not state: **one window per owner,
 * N sinks on it**, which is what makes a display's parallel per-region fetches
 * thin to one stream between them rather than to N. As a `throttle` argument
 * that rule lived in a paragraph asking callers not to pass a fresh one; here
 * the wrong thing has no spelling.
 */
export interface StatusWindow {
  /**
   * An {@link StatusCallback} writing to `write`, thinned through this window
   * and skipped entirely once `isCurrent()` goes false — a superseded fetch, or
   * a torn-down model.
   *
   * `isCurrent` is read twice on purpose. Once before the window, so a
   * superseded fetch's late status can't consume the slot a live one is waiting
   * on; once inside, because a trailing write fires on a timer and the operation
   * it belongs to can be gone by then. That second read is the load-bearing one
   * — without it a trailing status lands on a destroyed MST node.
   *
   * **Every status goes through the window, the `''` closing a phase
   * included** — so a phase that opens and closes inside it paints nothing.
   * ADR-071. The `''` still displaces the percentage queued behind it, because
   * the window holds one pending write, so a finished phase's progress cannot
   * reappear; it just lands on the trailing edge. Every owner ends its stream
   * with a {@link StatusWindow.flush} clear of its own, so nothing waits on that
   * write.
   */
  sink: (args: {
    isCurrent: () => boolean
    write: (status: RpcStatus) => void
  }) => StatusCallback
  /**
   * Write now, dropping anything queued behind it, and reopen. For the
   * **hand-written** clear an owner runs at the ends of its stream —
   * `createStopTokenRotation`'s `clearStatus`, `assembly.loadPre`'s `finally`.
   * Such a clear must land, because nothing else is coming to displace the last
   * label of a fetch that is over, and must supersede whatever the window still
   * holds from it.
   *
   * **Not for the `''` a phase helper closes with** — that goes through a sink
   * like every other status, so a phase shorter than the window paints nothing.
   * ADR-071.
   */
  flush: (apply: () => void) => void
  /**
   * Reopen, so the next fetch reports its first status at once, and drop any
   * queued trailing write — a reset accompanies clearing the status, which a
   * late write from the fetch being reset would undo.
   *
   * Reopening is the half that is easy to leave out: an owner clears at the
   * *start* of a fetch too, and charging that clear a full window would delay
   * the new fetch's first real status by one.
   */
  reset: () => void
}

// An RPC statusCallback fires per progress event (often ~40/s), and each write
// to the observable statusMessage/statusProgress re-renders whatever loading
// indicator is up (and repositions its MUI Tooltip/Popper) — re-renders were
// measured outpacing the zoom animation's own frame rate before this. A progress
// indicator gains nothing from updating faster.
const STATUS_THROTTLE_MS = 100

/**
 * Open a {@link StatusWindow}: leading-edge, so sparse updates pass straight
 * through and dense bursts are thinned. Create **one per owner** — a display, a
 * dialog run, an assembly load — and take every one of that owner's status
 * callbacks off it.
 *
 * Deliberately wraps only the *callback* path, never `setStatusMessage` itself
 * — a display writing a phase label by hand ("Downloading" → "Parsing") is a
 * sequence of distinct labels, and a trailing edge only guarantees the *last*
 * of a burst, not each one in turn.
 *
 * Trailing, not merely leading: the last write of a phase is the one that
 * matters most and is exactly the one a leading-edge-only gate drops. A
 * determinate bar otherwise froze at whatever percentage happened to land on a
 * window boundary, and the `''` that {@link updateStatus}/{@link withProgress}
 * clear with — always the write closing a dense burst — left a finished phase's
 * label on screen until something else wrote.
 *
 * Both fetch families own one: `FetchMixin` for the LGV displays, and
 * `createStopTokenRotation` for the bare-autorun fetches (dotplot, synteny)
 * that compose no fetch mixin — and a display that has both lends the mixin's
 * to the rotation rather than opening a second on one field. A plain function
 * rather than shared model state because the two families declare their status
 * fields separately and one set shadows the other — see ADR-041.
 */
export function createStatusWindow(): StatusWindow {
  let lastMs = 0
  let pending: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const clearPending = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    pending = undefined
  }
  const run = (apply: () => void) => {
    const now = Date.now()
    const wait = STATUS_THROTTLE_MS - (now - lastMs)
    if (wait <= 0) {
      // a write passing on the leading edge supersedes anything queued behind
      // it, so the trailing timer has nothing left to deliver
      clearPending()
      lastMs = now
      apply()
    } else {
      // only the newest write of a burst survives — an older progress value
      // is never what the user wants to be looking at
      pending = apply
      timer ??= setTimeout(() => {
        timer = undefined
        // a live timer always has a write behind it: it is scheduled in the
        // line above, right after `pending` is set, and `clearPending` drops
        // the two together. So this is an assertion rather than a fallback —
        // a `if (run)` here reads as a case that can happen, and would
        // silently skip the `lastMs` bump if it ever did
        const queued = pending!
        pending = undefined
        lastMs = Date.now()
        queued()
      }, wait)
    }
  }
  return {
    sink({ isCurrent, write }) {
      return status => {
        if (isCurrent()) {
          // re-read inside, because a trailing write fires on a timer and the
          // operation it belongs to can be gone by then
          run(() => {
            if (isCurrent()) {
              write(status)
            }
          })
        }
      }
    },
    flush(apply) {
      clearPending()
      lastMs = 0
      apply()
    },
    reset() {
      clearPending()
      lastMs = 0
    },
  }
}

/**
 * Format a phase label with a rounded percentage appended when a determinate
 * `fraction` is present (e.g. `progressLabel('Downloading', 0.45)` →
 * `"Downloading 45%"`). The single place the `X%` suffix is formatted: both
 * {@link statusProgressLabel} (RpcStatus callers) and the loading
 * overlays/indicators — which hold the message and fraction already split apart
 * onto the model — route through it, so no caller hand-rolls `Math.round`.
 */
export function progressLabel(
  message: string | undefined,
  fraction: number | undefined,
) {
  const percent = fraction === undefined ? '' : `${Math.round(fraction * 100)}%`
  return [message, percent].filter(Boolean).join(' ')
}

/**
 * {@link progressLabel} for an {@link RpcStatus}: the message, with a rounded
 * percentage appended when the status is determinate (e.g. `"Downloading 45%"`).
 * The form the loading dialogs use, holding the raw status object.
 */
export function statusProgressLabel(status: RpcStatus | undefined) {
  return progressLabel(statusMessageText(status), statusFraction(status))
}

/**
 * Adapt the byte-granularity download callback exposed by the readers
 * (generic-filehandle2 `readFile`, @gmod/tabix `getLines`, @gmod/bam /
 * @gmod/cram `getRecordsForRange`) to the structured {@link StatusCallback}
 * transport, labelling each tick with `message`. Returns undefined when there's
 * no `statusCallback`, so the reader can skip its progress bookkeeping entirely.
 *
 * That skip is not a saving, which is the opposite of what the shape suggests
 * and of what four comments in this tree used to claim. Handed an `onProgress`,
 * generic-filehandle2 streams the body into one pre-sized buffer; handed none it
 * calls `res.bytes()` — and in a Chrome worker the streaming read is roughly
 * 1.8x *faster* up to 10MB, giving that back only past ~25MB. So a progress bar
 * on a whole-file load is free or better at the sizes most of them are, and
 * withholding this reporter is about honoring a caller who asked for no
 * reporting, never about speed. Numbers and the bench that retakes them:
 * agent-docs/measurements/download-read-path.json.
 *
 * `total` is optional because not every reader knows the size up front
 * (generic-filehandle2 omits it when the response has no Content-Length): with a
 * total we emit a determinate bar, without one we emit just the label so the UI
 * still shows the phase as an indeterminate spinner.
 *
 * Internal to this module — the only caller is {@link downloadStatus}, which is
 * the API adapters use. Kept separate purely so the reporter logic reads on its
 * own line.
 */
function downloadStatusReporter(
  statusCallback: StatusCallback | undefined,
  message: string,
) {
  return statusCallback
    ? (current: number, total?: number) => {
        statusCallback(
          total === undefined ? message : { message, current, total },
        )
      }
    : undefined
}

/**
 * Run a download phase with byte-granularity progress. Shows `label`, hands
 * `fn` the {@link downloadStatusReporter} to pass straight to an index reader's
 * `onProgress` (byte ticks upgrade the same label to a determinate bar), then
 * clears the status. Combines {@link updateStatus} with the reporter so the
 * label is written in exactly one place — the phase label and the progress
 * label can't drift apart.
 */
export async function downloadStatus<T>(
  label: string,
  statusCallback: StatusCallback | undefined,
  fn: (onProgress: ReturnType<typeof downloadStatusReporter>) => T | Promise<T>,
): Promise<T> {
  return updateStatus(label, statusCallback, () =>
    fn(downloadStatusReporter(statusCallback, label)),
  )
}

/**
 * One concurrent operation's contribution to a fan-out's shared status: what it
 * is reporting right now, plus how much of each phase it has already finished
 * (see {@link createStatusFanOut}, which is what records them).
 *
 * `completed` is a total per phase, not the phases themselves: a finished phase
 * is charged to both halves of the fraction, so its own `current` was only ever
 * its `total` written twice.
 */
export interface StatusSlot {
  status: RpcStatus | undefined
  completed: Map<string, number>
}

/** How much of `message` this slot has already finished. */
function finished(slot: StatusSlot, message: string) {
  return slot.completed.get(message) ?? 0
}

/**
 * A phase some in-flight slot is reporting, and everything the vote in
 * {@link aggregateStatus} weighs about it.
 */
interface PhaseVote {
  message: string
  /** in-flight slots reporting it */
  count: number
  /** of those, how many are measuring it this instant */
  live: number
  /** Σ `total` over those, for the mean an unmeasured slot is charged */
  liveTotal: number
  /** position in `phaseOrder`; an unseen phase ranks last */
  rank: number
  /** some slot has already finished part of it */
  anyFinished: boolean
}

/**
 * Does the batch have a measurement for this phase at all — one running now, or
 * one it already retired? This is what separates a phase a region is still
 * working through from one it has merely announced, and so what a tie between
 * two phases turns on before their order does.
 */
function measurable(vote: PhaseVote) {
  return vote.live > 0 || vote.anyFinished
}

/**
 * Combine the in-flight statuses of several concurrent operations (one RPC per
 * visible region, say) into the single status the loading UI shows, so N regions
 * read as one bar instead of each clobbering the shared field. Returns undefined
 * when nothing is in flight.
 *
 * **Only operations in the same phase are summed.** `current`/`total` are
 * additive within a phase — bytes with bytes, features with features — and
 * incommensurable across one, so one phase wins and the rest are charged below.
 * ADR-072; a plain Σcurrent/Σtotal put a bar under whichever slot had the
 * largest raw total. A fan-out whose slots share one phase — the common case,
 * and what the sum was written for — is summed exactly as before.
 *
 * The phase that wins is the one the most operations are **in**, which is the
 * phase they last reported and not the phase they happen to be measuring this
 * instant. Voting on the measurement instead let a slot drop out of its own
 * phase's count every time it sat between two reads reporting only the label:
 * two regions, one laying out and one downloading, alternated 1-1 and 1-0, so
 * the shared label and the whole denominator under it swapped back and forth
 * several times a second (measured: "Computing layout 10%" → "Downloading
 * features 67%" → "Computing layout 20%").
 *
 * Ties break to the phase with something to measure, and then to the phase the
 * batch reached first (`phaseOrder`). Both terms earn their place: without the
 * first, a region still opening its index holds the label — and its bar — over
 * a region already reporting bytes; without the second, two regions one phase
 * apart flap, since which one is measuring changes at every phase boundary
 * either one crosses. "Something to measure" counts finished work as well as a
 * live reading, which is what separates the two cases — a phase this batch has
 * already measured is one it is genuinely still in. With no order at all every
 * phase ranks the same and the tie falls back to slot order.
 *
 * Each slot is then priced against the winning phase on its own, which is the
 * part that has to be per-slot rather than a Σ over two flat lists:
 *
 * - measuring it: its own `current`/`total`, plus whatever it already finished
 *   of that phase in both halves.
 * - not measuring it, but it finished some of it: that finished work in both
 *   halves and **nothing more**. It is not also charged the mean below. Charging
 *   both is what made the bar fall every time a region moved on — a region that
 *   had downloaded its 100kb and gone on to parse read as 100kb done *and* an
 *   unmeasured 100kb still to do.
 * - neither: it is an operation in flight with nothing comparable to measure, so
 *   it is charged the mean of the totals we do know, with nothing completed
 *   against it. That covers a response with no Content-Length and a slot in a
 *   different phase alike. Dropping the first outright is what let a fan-out
 *   where one region's response carried no Content-Length read 100% with that
 *   region still downloading.
 *
 * A winning phase that nothing is measuring right now comes back as its label
 * alone. Its finished work cannot stand in for a reading — every slot being
 * between reads at that instant is exactly when it would, and summing what they
 * retired at reads 100% for a batch that is still working. {@link
 * createStatusFanOut} re-sends that phase's last real reading instead.
 *
 * A retired slot (`''` or nothing yet) is not in flight: it never votes and is
 * never charged the mean — charging it at zero is a bar that runs *backwards* as
 * regions finish (three done and one at half of its 1000 reading 500/4000 rather
 * than 500/1000). Its finished work still counts, which is the reason the bar no
 * longer drops as the batch lands: 500/1000 becomes 3500/4000 and the fraction
 * only ever rises.
 */
export function aggregateStatus(
  slots: StatusSlot[],
  phaseOrder: string[] = [],
): RpcStatus | undefined {
  const inFlight = slots.filter(
    (s): s is StatusSlot & { status: RpcStatus } =>
      s.status !== undefined && s.status !== '',
  )
  if (inFlight.length === 0) {
    return undefined
  }
  const votes = new Map<string, PhaseVote>()
  for (const slot of inFlight) {
    const message = phaseOf(slot.status)
    let vote = votes.get(message)
    if (vote === undefined) {
      // an unseen phase ranks last, and with no order at all every phase ranks
      // the same — which leaves the reduce below keeping its incumbent, the
      // slot-order tie-break this had before
      const at = phaseOrder.indexOf(message)
      vote = {
        message,
        count: 0,
        live: 0,
        liveTotal: 0,
        rank: at === -1 ? phaseOrder.length : at,
        anyFinished: slots.some(s => finished(s, message) > 0),
      }
      votes.set(message, vote)
    }
    vote.count++
    if (typeof slot.status === 'object') {
      vote.live++
      vote.liveTotal += slot.status.total
    }
  }
  // lexicographic: how many slots are in the phase, then whether it has anything
  // to measure at all, then how early the batch reached it
  const better = (a: PhaseVote, b: PhaseVote) =>
    a.count !== b.count
      ? a.count > b.count
      : measurable(a) !== measurable(b)
        ? measurable(a)
        : a.rank < b.rank
  const best = [...votes.values()].reduce((winner, vote) =>
    better(vote, winner) ? vote : winner,
  )
  const { message } = best
  // nothing is measuring the winner, so its label alone goes out: summing what
  // its slots retired at reads 100% for a batch that is still going
  if (best.live === 0) {
    return message
  }
  const mean = best.liveTotal / best.live

  let current = 0
  let total = 0
  for (const slot of slots) {
    // finished work is charged in full to both halves, which is what stops the
    // denominator shrinking as regions land
    const done = finished(slot, message)
    current += done
    total += done
    const { status } = slot
    if (typeof status === 'object' && status.message === message) {
      current += status.current
      total += status.total
    } else if (done === 0 && status !== undefined && status !== '') {
      // in flight with nothing comparable to measure, so charged the mean — and
      // only here. A slot already credited for this phase is not charged for it
      // a second time, which is what made the bar fall as regions moved on.
      total += mean
    }
  }
  return { message, current, total }
}

/**
 * Fan one status field out to several concurrent operations that would
 * otherwise fight over it. Each `slot()` returns a {@link StatusCallback}
 * remembering its own latest value and how much of each phase it has been
 * through; every write re-derives the shared status from all slots through
 * {@link aggregateStatus}, so N concurrent downloads read as one bar instead of
 * last-writer-wins — and the first one to finish (which writes the `''` every
 * phase helper clears with) can't blank the label while the others are still
 * running.
 *
 * Use it wherever several operations are handed one `statusCallback` at once —
 * a `Promise.all`, an rxjs `merge`, or the per-region fan-out the LGV displays'
 * `callEachRegion` builds over a fetch context. One fan-out per batch: slots are
 * taken for the batch's lifetime and it is the batch that ends, so a long-lived
 * one accumulates slots for work that is over.
 *
 * **A slot's finished phases are recorded here** because only a slot's own
 * channel ever sees the total it retired at, and they are what keep a landing
 * batch's bar from walking backwards. A phase is over the moment the slot stops
 * reporting it forward — see {@link continuesPhase}, and note that the `''` it
 * ends on is only one of the ways it can say so.
 *
 * **It never writes `''`.** A slot between two phases and a slot that is done
 * both read as idle from here, so an empty aggregate cannot mean "the batch is
 * over" — it means "no slot is reporting this instant". Writing `''` for that
 * blanked the shared label mid-batch, and the loading UI renders a blank label
 * as its "Loading" fallback: two regions crossing a phase boundary together
 * flapped between "Loading" and the phase they were both still in. What goes out
 * instead is the last label alone, with no bar — indeterminate, which is exactly
 * what "still in this phase, nothing measuring it right now" is.
 *
 * Something rather than nothing, because a write that lands is also how a phase's
 * last progress value is *displaced*: statuses are throttled, so a percentage
 * queued behind the window would otherwise fire after the work it measured had
 * ended (ADR-071). Every owner of a status field clears it when its own work ends
 * (`runFetch`'s `resetStatus`, `assembly.loadPre`'s `finally`,
 * `createStopTokenRotation`'s `end`), and the end of the batch is theirs to
 * declare, not ours to guess.
 *
 * **A phase does not lose its bar because nothing is measuring it this
 * instant.** Between a slot's reads it reports the label alone, and when every
 * slot in a fan-out is between reads at once the aggregate has no measurement to
 * report — so the determinate bar dropped to an indeterminate spinner and came
 * back a tick later. Three blocks doing their redispatch flanks made that happen
 * seven times in two seconds, which is what a "Downloading features" that blinks
 * actually is. The phase's last reading is held and re-sent instead: it is the
 * most recent true statement about that phase, and it stops being sent the moment
 * the phase changes.
 */
export function createStatusFanOut(statusCallback: StatusCallback | undefined) {
  const slots: StatusSlot[] = []
  // the phases this batch has been through, in the order it reached them, so a
  // tie between two slots in different phases resolves the same way twice
  const phaseOrder: string[] = []
  // the current phase's last determinate reading — what a moment with nothing
  // measuring it falls back to, rather than downgrading what we already know.
  // Dropped the moment the batch is in some other phase, or in none.
  let held: StatusWithProgress | undefined
  // the last label of any kind, which outlives that: it is all there is to say
  // once nothing is in flight, and saying it is what displaces the percentage
  // queued behind the throttle
  let lastMessage: string | undefined
  return (): StatusCallback => {
    const slot: StatusSlot = { status: undefined, completed: new Map() }
    slots.push(slot)
    return status => {
      // what this slot just finished, credited at the total it retired at —
      // only its own channel ever saw that number
      const previous = slot.status
      if (typeof previous === 'object' && !continuesPhase(previous, status)) {
        const { message, total } = previous
        slot.completed.set(message, finished(slot, message) + total)
      }
      slot.status = status
      // every label, not only the determinate ones: an indeterminate phase that
      // ties with another has to rank somewhere too, and it is the first slot to
      // say the words that dates the phase either way
      const phase = statusMessageText(status)
      if (phase !== undefined && !phaseOrder.includes(phase)) {
        phaseOrder.push(phase)
      }
      const aggregate = aggregateStatus(slots, phaseOrder)
      const message = statusMessageText(aggregate)
      // A held reading describes one phase, and survives exactly as long as the
      // batch is still in it. "Nothing in flight" is not that phase either: an
      // empty aggregate is a batch with no work outstanding, and re-sending a
      // percentage for work that has ENDED is the write ADR-071 exists to
      // cancel. Both cases are one comparison, because an empty aggregate names
      // no phase.
      if (held?.message !== message) {
        held = undefined
      }
      if (typeof aggregate === 'object' && !readsComplete(aggregate)) {
        held = aggregate
      }
      if (message !== undefined) {
        lastMessage = message
      }
      // the best available answer to "what is this batch doing", in order: a
      // reading we trust, whatever the aggregate says, the last label we saw
      const out = held ?? aggregate ?? lastMessage
      if (out !== undefined) {
        statusCallback?.(out)
      }
    }
  }
}

/**
 * Does this reading say the work is finished? A fan-out's aggregate exists only
 * while a slot is in flight, so a full one is never the truth — a slot that has
 * retired its read while another is still measuring is what produces it, and the
 * moment the retired one opens its next read the fraction falls back. Three
 * blocks taking their redispatch flanks made the bar toggle 100/98 nine times in
 * two seconds.
 *
 * So it is neither held nor shown when there is a real reading to show instead;
 * the phase ending is what moves the label on. Not a clamp on the arithmetic —
 * {@link aggregateStatus} still reports what it computes, and a bar that falls
 * because a region *joined* the batch still falls, which is a true statement
 * about work that was not there before.
 */
function readsComplete(status: StatusWithProgress) {
  return status.total > 0 && status.current >= status.total
}

/**
 * Is `status` the same determinate phase as `previous`, still running? Only a
 * measurement of the same phase moving forward is; everything else retires it.
 *
 * The `''` a phase helper clears with is the obvious retirement and used to be
 * the only one recognized, which meant the common shape recorded nothing at all:
 * phases nest, so an inner phase closes onto its *enclosing* phase's label (see
 * {@link openPhase}) — a plain string, not `''` — and the canvas feature fetch
 * is exactly that, an adapter's byte-counted "Downloading features" inside the
 * RPC's own "Downloading features". Every region's bytes fell out of both halves
 * of the fraction the instant its download finished.
 *
 * A measurement that moves *backwards* under the same label retires the phase
 * too: it is a second phase of the same name starting at zero, which is what the
 * tabix redispatch does when a feature overhangs the query and the region is
 * read a second time.
 */
function continuesPhase(previous: StatusWithProgress, status: RpcStatus) {
  return (
    typeof status === 'object' &&
    status.message === previous.message &&
    status.current >= previous.current
  )
}

/**
 * Call once per outer-loop iteration. With no argument it auto-increments an
 * internal counter (the elegant default — `for (…) report()`); pass an explicit
 * `current` when the caller tracks its own position, e.g. a running offset that
 * spans several batches.
 */
export type ProgressReporter = (current?: number) => void

/**
 * The single per-iteration callback for long synchronous worker loops. The
 * returned `report(current)` is called once per outer-loop iteration and does
 * two throttled jobs on each call:
 *
 * - checks the stop token via the existing throttled {@link checkStopTokenThrottled}
 *   machinery, so cancellation interrupts the loop within milliseconds instead
 *   of only at phase boundaries, and
 * - emits a {@link StatusWithProgress} through `statusCallback` at most once per
 *   `throttleMs`, so the main thread gets a live percentage without flooding
 *   the postMessage channel.
 *
 * Both jobs are optional: with no `statusCallback`/`total` this is purely a
 * throttled cancellation tick (the replacement for calling {@link
 * checkStopTokenThrottled} directly in a loop), so a loop has exactly one inner
 * callback whether or not it drives the progress UI.
 *
 * Emission is gated on wall-clock time (`throttleMs`) through {@link
 * createTimeGate}, which caps emits at ~1/throttleMs. This used to read the
 * clock on every call, reasoning that it was negligible next to the per-item
 * work; at a 666k-read pileup that measured ~28ms, so the gate now thins the
 * clock reads too — see createTimeGate for why its stride is learned rather
 * than fixed (a fixed one froze this bar at 0% for low-count/heavy phases).
 * Keep the loop a plain `for`; just call `report()` once per item (it owns the
 * counter) — or `report(n)` to report an explicit position.
 *
 * Reuses {@link createStopTokenChecker}, matching the cancellation convention
 * already used across the variant/alignments/gwas RPC paths.
 */
export function createProgressReporter({
  label = '',
  total,
  statusCallback,
  stopToken,
  stopTokenCheck,
  throttleMs = 100,
}: {
  label?: string
  total?: number
  statusCallback?: (status: RpcStatus) => void
  stopToken?: StopToken
  stopTokenCheck?: StopTokenChecker
  throttleMs?: number
}): ProgressReporter {
  const checker = stopTokenCheck ?? createStopTokenChecker(stopToken)
  const emitDue = createTimeGate()
  let count = 0
  return (current = count) => {
    count = current + 1
    checkStopTokenThrottled(checker)
    if (
      statusCallback !== undefined &&
      total !== undefined &&
      emitDue(throttleMs)
    ) {
      statusCallback({ message: label, current, total })
    }
  }
}

/**
 * Run a measurable phase: shows `label` at 0%, hands `fn` a {@link
 * ProgressReporter} to drive during the work, then checks the stop token once
 * more and restores the enclosing phase. The determinate counterpart to
 * `updateStatus`, and it nests the same way — see {@link openPhase}.
 */
export async function withProgress<T>(
  {
    label,
    total,
    statusCallback,
    stopToken,
  }: {
    label: string
    total: number
    statusCallback?: (status: RpcStatus) => void
    stopToken?: StopToken
  },
  fn: (report: ProgressReporter) => T | Promise<T>,
): Promise<T> {
  const report = createProgressReporter({
    label,
    total,
    statusCallback,
    stopToken,
  })
  const endPhase = openPhase(statusCallback, label)
  report(0)
  try {
    return await withStopTokenCheck(stopToken, () => fn(report))
  } finally {
    endPhase()
  }
}
