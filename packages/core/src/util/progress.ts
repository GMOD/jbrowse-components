import {
  checkStopTokenThrottled,
  createStopTokenChecker,
  withStopTokenCheck,
} from './stopToken.ts'
import { createTimeGate } from './timeGate.ts'

import type { StopToken, StopTokenChecker } from './stopToken.ts'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

// The out-of-band progress channel, from a worker's phase helpers to the one
// status field a loading indicator reads. Why it is shaped this way:
// ADR-071 (every status goes through the window), ADR-072 (only one phase at a
// time is summable), ADR-080 (a phase ends when its slot stops reporting it),
// ADR-087 (a phase's retire says how it ended). Those hold the defects each rule
// was written against; this file states the rules.
//
// `''` is the phase-over sentinel throughout, and nothing may rewrite it into a
// label — see {@link statusMessageText}. A retire that carries the `failed` flag
// as well is a phase that stopped short — see {@link PhaseFailure}.

// The phases currently open on one status channel, keyed by the callback that
// *is* that channel. Entries are objects rather than strings so a phase removes
// its own on the way out by identity: two phases running concurrently on one
// callback (a `Promise.all` handed the same one) finish in either order, and a
// LIFO pop would retire the wrong one.
//
// A WeakMap, so a channel that goes away takes its stack with it, and a caller
// that builds a fresh callback per call gets a fresh stack.
interface OpenPhase {
  label: string
}
const openPhases = new WeakMap<StatusCallback, OpenPhase[]>()

/**
 * Open a phase on `cb`'s channel and return its close. The close emits the
 * enclosing phase's label, or `''` when this was the outermost — which is what
 * makes phases nest, so an inner phase cannot blank the label its caller set for
 * the rest of the caller's work.
 *
 * `''` closing the outermost phase is what every consumer reads as "this phase
 * is over": a {@link StatusWindow} thins it like any other status, and
 * {@link aggregateStatus} reads it as "not in flight".
 *
 * The close takes the {@link PhaseOutcome}, because it is the one place that
 * knows it — a phase that finished and a phase that threw retire the same label,
 * and only the `finally` around the work can tell them apart.
 */
function openPhase(cb: StatusCallback | undefined, label: string) {
  if (cb === undefined) {
    return (_outcome: PhaseOutcome) => {}
  }
  let stack = openPhases.get(cb)
  if (stack === undefined) {
    stack = []
    openPhases.set(cb, stack)
  }
  const phase: OpenPhase = { label }
  stack.push(phase)
  return (outcome: PhaseOutcome) => {
    const index = stack.lastIndexOf(phase)
    if (index !== -1) {
      stack.splice(index, 1)
    }
    const message = stack.at(-1)?.label ?? ''
    cb(outcome === 'failed' ? { message, failed: true } : message)
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
 * Nests — see {@link openPhase}. An inner phase's close restores the enclosing
 * label and not its bar; the enclosing phase's next `report()` re-establishes
 * it, and one with none to send was indeterminate anyway.
 */
export async function updateStatus<U>(
  msg: string,
  cb: StatusCallback | undefined,
  fn: () => U | Promise<U>,
  stopToken?: StopToken,
) {
  const endPhase = openPhase(cb, msg)
  // pessimistic, so anything leaving this scope other than a value — a throw, a
  // cancel — retires the phase as unfinished
  let outcome: PhaseOutcome = 'failed'
  // everything after the open is inside the try, the announcing write included,
  // so a throw anywhere cannot leave this phase's label sitting on the channel
  // forever — the error surfaces under a stale "Downloading file"
  try {
    cb?.(msg)
    const result = await withStopTokenCheck(stopToken, fn)
    outcome = 'completed'
    return result
  } finally {
    endPhase(outcome)
  }
}

/**
 * A determinate reading on the status channel: a phase label plus how far
 * through it the operation is. The loading UI renders the message and a bar.
 */
export interface StatusWithProgress {
  message: string
  current: number
  total: number
}

/**
 * How a phase ended. Only the `finally` that closes it knows, and
 * {@link PhaseFailure} is how it says so on the channel.
 */
type PhaseOutcome = 'completed' | 'failed'

/**
 * The last word of a phase that did not finish: the label its retire leaves on
 * the channel — the enclosing phase's, or `''` when there was none — plus the
 * one thing no reading can carry, that the work under it stopped short.
 *
 * **The aggregate cannot infer this from the readings**, which is why it is on
 * the wire. A phase clear and a phase that threw arrive as the same `''`, and on
 * the per-region fetch path a clear *is* a completion — charging it less than
 * its total is what made the shared bar run backwards as a batch landed
 * (ADR-072, and `FetchMixin.test.ts` pins it by name). So the outcome travels as
 * a value the `finally` writes, and the credit follows the value.
 *
 * **A value rather than a second callback argument**, because it has to survive
 * every `status => cb(status)` forwarder in the tree and the worker's
 * postMessage: `wrapForRpc` posts one status, and an extra argument would be
 * dropped in silence at each of those seams.
 *
 * A consumer that only understands the falsy-message retire keeps working:
 * `message` is the same string it would have been handed, so
 * {@link statusMessageText} and {@link statusFraction} answer exactly as they do
 * for a bare `''`. The marker is read by the first {@link createStatusAggregate}
 * it reaches, which credits the retiring phase what it transferred and then
 * stores the plain message — so it never reaches a display's status field.
 */
export interface PhaseFailure {
  message: string
  failed: true
}

export type RpcStatus = string | StatusWithProgress | PhaseFailure

/**
 * The single out-of-band status transport carried across the RPC boundary. A
 * plain string is an indeterminate phase label; a {@link StatusWithProgress}
 * adds a determinate fraction. Adapters wrap raw byte/block/feature counts into
 * this; the loading UI renders the message and (when present) a progress bar.
 */
export type StatusCallback = (status: RpcStatus) => void

function isPhaseFailure(status: RpcStatus): status is PhaseFailure {
  return typeof status === 'object' && 'failed' in status
}

/**
 * The determinate reading in `status`, or undefined when there is none — a bare
 * label, or the last word of a phase that threw. The one place the transport's
 * union is narrowed to a `current`/`total`, so a consumer reading the numbers
 * cannot mistake a {@link PhaseFailure} for a measurement.
 */
export function statusReading(status: RpcStatus | undefined) {
  return typeof status === 'object' && !isPhaseFailure(status)
    ? status
    : undefined
}

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
 * `''` is none: it is the phase-over sentinel, not a label. Normalizing it here
 * leaves one spelling of "nothing to show" for the three models that store a
 * `statusMessage` (`assembly`, `BaseDisplayModel`, `FetchMixin`) — otherwise a
 * reset's `undefined` and a phase's `''` read the same on screen
 * (`message || 'Loading'`) and differently to everything else.
 *
 * The corollary binds anything that *transforms* a status: rewriting `''` into
 * any other string — a prefix, a default — makes a phase that never ends, since
 * a slot's last word is what {@link aggregateStatus} weighs. `levelStatusCallback`
 * in `runDiagonalize.ts` is the one transformer in the tree.
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
  const reading = statusReading(status)
  return reading !== undefined && reading.total > 0
    ? Math.min(1, reading.current / reading.total)
    : undefined
}

/**
 * One operation's stream through a {@link StatusWindow}, and the last word that
 * ends it. They come back together because **every operation must retire its
 * own slot when its work ends**: neither a window nor a fan-out can see the end
 * of a batch and neither guesses at one (ADR-080), so a stream nobody closes
 * goes on voting for a phase that is over.
 */
export interface StatusStream {
  /** The RPC `statusCallback` for this operation. */
  statusCallback: StatusCallback
  /**
   * This operation's last word: retires its slot, re-derives the field from the
   * operations still running, and blanks it when this was the last of them.
   * Call it once, in the `finally` of the operation this stream describes.
   *
   * **Retiring, not blanking**, which is the difference a display with two
   * concurrent operations turns on (ADR-081). The blank still lands unthrottled
   * and drops what was queued behind it, because nothing is coming to displace
   * the last label of a fetch that is over.
   *
   * It is not guarded by `isCurrent`: a run that has just finished is no longer
   * current, and a superseded run must retire its slot too or it votes forever.
   */
  clear: () => void
}

/**
 * One owner's status field: the throttle window in front of it, the slot each
 * concurrent operation writes into, and the aggregate that arbitrates between
 * them.
 *
 * All three are one object so the cardinality rule has only one spelling: **one
 * window per owner, N streams on it, one field**. That is what makes a
 * display's parallel per-region fetches thin to one flow between them rather
 * than to N, and what stops its viewport fetch and its bare-autorun fetch
 * clobbering each other (ADR-081).
 */
export interface StatusWindow {
  /**
   * Open a stream for one operation: a {@link StatusCallback} recording into
   * this operation's own slot, skipped entirely once `isCurrent()` goes false —
   * a superseded fetch, or a torn-down model — plus the `clear` that retires it.
   *
   * `isCurrent` is read twice on purpose. Once before the window, so a
   * superseded fetch's late status can't consume the slot a live one is waiting
   * on; once inside, because a trailing write fires on a timer and the
   * operation it belongs to can be gone by then.
   *
   * Opening on an idle window reopens the throttle, so the first operation to
   * start after a lull reports at once rather than being charged a window it
   * did nothing to earn. An owner therefore never resets by hand around a
   * fetch; `reset` is for teardown.
   *
   * **Every status goes through the window, the `''` closing a phase
   * included** (ADR-071), so a phase that opens and closes inside one paints
   * nothing. The window holds a single pending write, so that `''` still
   * displaces the percentage queued behind it and a finished phase's progress
   * cannot reappear.
   */
  open: (args: { isCurrent: () => boolean }) => StatusStream
  /**
   * Drop the queued trailing write and reopen the throttle. For the owner's
   * teardown, where the timer outlives everything that could make it a no-op —
   * jest reports the surviving timer as a worker that will not exit.
   */
  reset: () => void
}

/**
 * The shared state behind {@link createStatusFanOut} and {@link
 * createStatusWindow}: N slots, the order the batch reached each phase in, and
 * the last reading worth re-sending. Both of them are "several concurrent
 * operations, one status" — the fan-out over the regions of one fetch, the
 * window over the operations of one display — and the arbitration is the same
 * either way, so it is written once.
 *
 * The two differ in what they do with the answer — the fan-out feeds a callback
 * that has no way to say "nothing", the window owns a field it can blank — and
 * in `holdLastReading`.
 *
 * **Hold only where the slots are raw reporters.** ADR-080's rule that a phase
 * does not lose its bar because nothing is measuring it *this instant* is about
 * one batch's peers sitting between reads. A slot fed by another aggregate has
 * already had the rule applied to it: its bare label means "my children have no
 * measurement", not "I am between reads", and holding over that puts back a
 * percentage the child deliberately retired — the write ADR-071 exists to
 * cancel. A window's slots are whole operations, and the commonest window has
 * exactly one, where a held reading can only ever be older than what the slot
 * just said.
 */
function createStatusAggregate({ holdLastReading = false } = {}) {
  const slots: StatusSlot[] = []
  // every phase this batch has reached, against the order it reached them in,
  // so a tie between two slots in different phases resolves the same way twice
  const phaseRank = new Map<string, number>()
  // the current phase's last determinate reading — what a moment with nothing
  // measuring it falls back to, rather than downgrading what we already know.
  // Dropped the moment the batch is in some other phase, or in none.
  let held: StatusWithProgress | undefined
  // the last label of any kind, which outlives that: it is all there is to say
  // once nothing is in flight, and saying it is what displaces the percentage
  // queued behind the throttle
  let lastMessage: string | undefined

  /**
   * The best available answer to "what is this batch doing", in order: a
   * reading we trust, whatever the aggregate says, the last label we saw.
   * Undefined only while no slot has ever reported.
   */
  const derive = () => {
    const aggregate = aggregateStatus(slots, phaseRank)
    const message = statusMessageText(aggregate)
    // A held reading describes one phase, and survives exactly as long as the
    // batch is still in it. "Nothing in flight" is not that phase either: an
    // empty aggregate is a batch with no work outstanding, and re-sending a
    // percentage for work that has ENDED is the write ADR-071 exists to cancel.
    // Both cases are one comparison, because an empty aggregate names no phase.
    if (held?.message !== message) {
      held = undefined
    }
    const reading = statusReading(aggregate)
    if (holdLastReading && reading !== undefined && !readsComplete(reading)) {
      held = reading
    }
    if (message !== undefined) {
      lastMessage = message
    }
    return held ?? aggregate ?? lastMessage
  }

  return {
    idle: () => slots.length === 0,
    size: () => slots.length,
    add() {
      const slot: StatusSlot = { status: undefined, completed: new Map() }
      slots.push(slot)
      return slot
    },
    /**
     * Retire a slot. Its finished phases go with it — one operation's bytes
     * were never the denominator of another's, and a slot kept for its
     * `completed` alone is the accumulation a long-lived aggregate cannot
     * afford. Emptying resets the phase order too: idle is the batch boundary,
     * and a rank recorded an hour ago has no business ordering today's phases.
     */
    remove(slot: StatusSlot) {
      const index = slots.indexOf(slot)
      if (index !== -1) {
        slots.splice(index, 1)
      }
      // a held reading describes an aggregate this slot was part of
      held = undefined
      if (slots.length === 0) {
        phaseRank.clear()
        lastMessage = undefined
      }
    },
    /** Record one slot's status, then re-derive the shared value. */
    update(slot: StatusSlot, status: RpcStatus) {
      // what this slot just finished, credited at the total it retired at —
      // only its own channel ever saw that number
      const previous = statusReading(slot.status)
      if (previous !== undefined && !continuesPhase(previous, status)) {
        const { message, current, total } = previous
        // A phase that ENDED is charged its total: its `current` was only ever
        // its total written twice, and undercharging it is what made the bar run
        // backwards as a batch landed. A phase that THREW is charged what it
        // transferred — the 900 bytes a dead socket will never carry are not
        // work this batch completed, and crediting them walked the bar forward
        // on a failure. Nothing in the readings separates the two, so
        // {@link PhaseFailure} carries the difference.
        slot.completed.set(
          message,
          finished(slot, message) + (isPhaseFailure(status) ? current : total),
        )
      }
      // the marker is consumed here. From now on the slot is simply reporting
      // the label the retire left behind, so nothing downstream — a parent
      // channel, a display's field — has to know the shape exists.
      slot.status = isPhaseFailure(status) ? status.message : status
      // every label, not only the determinate ones: an indeterminate phase that
      // ties with another has to rank somewhere too, and it is the first slot to
      // say the words that dates the phase either way
      const phase = statusMessageText(status)
      if (phase !== undefined && !phaseRank.has(phase)) {
        phaseRank.set(phase, phaseRank.size)
      }
      return derive()
    },
    derive,
  }
}

// An RPC statusCallback fires per progress event (often ~40/s), and each write
// to the observable statusMessage/statusProgress re-renders whatever loading
// indicator is up (and repositions its MUI Tooltip/Popper) — re-renders were
// measured outpacing the zoom animation's own frame rate before this. A progress
// indicator gains nothing from updating faster.
const STATUS_THROTTLE_MS = 100

/**
 * Thin one channel's status emits at the *source*, for a transport that pays
 * per message.
 *
 * {@link createStatusWindow} already throttles what reaches a display's status
 * field, but it runs on the main thread: every emit the worker made still cost
 * a postMessage, a task and a structured clone to get there and be dropped. A
 * scroll-zoom measured 9,668 of those in ten seconds — 23% of the main thread's
 * busy time — for the ~100 statuses the window let through.
 *
 * What it drops is only ever an intermediate reading of a phase a later reading
 * of the same phase supersedes, so {@link createStatusAggregate} is unaffected:
 * it takes the latest reading per slot, and credits a phase its total only when
 * the *label* changes. A change of label — including the `''` retire — and a
 * {@link PhaseFailure} therefore go through untouched, and a reading queued
 * behind the window is flushed ahead of the label that supersedes it so the
 * transition still carries the phase's own last numbers.
 */
export function throttleStatusEmits(emit: StatusCallback) {
  let lastEmitMs = 0
  let lastPhase: string | undefined
  let queued: RpcStatus | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const send = (status: RpcStatus) => {
    lastEmitMs = Date.now()
    lastPhase = phaseOf(status)
    emit(status)
  }
  const clearQueued = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
    queued = undefined
  }
  return (status: RpcStatus) => {
    const wait = STATUS_THROTTLE_MS - (Date.now() - lastEmitMs)
    if (wait > 0 && phaseOf(status) === lastPhase && !isPhaseFailure(status)) {
      queued = status
      timer ??= setTimeout(() => {
        timer = undefined
        // an assertion rather than a guard: the timer is scheduled in the same
        // breath as the write to `queued`, and `clearQueued` drops the two
        // together
        const pending = queued!
        queued = undefined
        send(pending)
      }, wait)
    } else {
      if (queued !== undefined) {
        send(queued)
      }
      clearQueued()
      send(status)
    }
  }
}

/**
 * Open a {@link StatusWindow} over one status field. `write` is that field's
 * **only** writer, statuses and the closing blank alike, so whatever guards it
 * — `isAlive(self)`, a React `alive` flag — guards every one of them by
 * construction rather than by a copy of the check at each `finally`.
 *
 * Leading-edge, so sparse updates pass straight through and dense bursts are
 * thinned; trailing as well, so the last write of a phase always lands — it is
 * the one that matters most and exactly the one a leading-edge-only gate drops.
 *
 * Create **one per owner** — a display, a dialog run, an assembly load — and
 * take every one of that owner's status callbacks off it as a stream. The
 * streams are slots in one aggregate, so the owner's two concurrent operations
 * arbitrate for the field the same way one fetch's parallel regions do, and
 * neither ends the other's label (ADR-081).
 *
 * Deliberately wraps only the *callback* path, never `setStatusMessage` itself
 * — a display writing a phase label by hand ("Downloading" → "Parsing") is a
 * sequence of distinct labels, and a trailing edge only guarantees the *last*
 * of a burst, not each one in turn.
 *
 * Both fetch families own one: `FetchMixin` for the LGV displays, and
 * `createStopTokenRotation` for the bare-autorun fetches (dotplot, synteny)
 * that compose no fetch mixin — and a display that has both lends the mixin's
 * to the rotation rather than opening a second on one field. A plain function
 * rather than shared model state because the two families declare their status
 * fields separately and one set shadows the other — see ADR-041.
 */
export function createStatusWindow(
  write: (status: RpcStatus | undefined) => void,
): StatusWindow {
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
        // an assertion, not a fallback: the timer is scheduled right after
        // `pending` is set and `clearPending` drops the two together, so an
        // `if (pending)` here would read as a reachable case and silently skip
        // the `lastMs` bump
        const queued = pending!
        pending = undefined
        lastMs = Date.now()
        queued()
      }, wait)
    }
  }
  const reset = () => {
    clearPending()
    lastMs = 0
  }
  const aggregate = createStatusAggregate()
  // never skipped: the value is `undefined` only before any slot has spoken,
  // and a slot that has just spoken is one that has
  const emit = (status: RpcStatus | undefined) => {
    if (status !== undefined) {
      write(status)
    }
  }
  return {
    open({ isCurrent }) {
      // an operation starting after a lull reports at once; one starting beside
      // a running sibling waits its turn in the sibling's cadence
      if (aggregate.idle()) {
        reset()
      }
      const slot = aggregate.add()
      warnOnSlotLeak(aggregate.size())
      let live = true
      return {
        statusCallback: status => {
          if (live && isCurrent()) {
            // recorded now, derived again when the write lands: a status that
            // waited out the window would otherwise describe the slots as they
            // were when it was queued, and a sibling may have retired since
            aggregate.update(slot, status)
            run(() => {
              // re-read inside, because a trailing write fires on a timer and
              // the operation it belongs to can be gone by then — a run that
              // has since been stopped must not restore the label "Stopping"
              // has already replaced
              if (isCurrent()) {
                emit(aggregate.derive())
              }
            })
          }
        },
        clear() {
          if (!live) {
            return
          }
          live = false
          aggregate.remove(slot)
          if (aggregate.idle()) {
            // the owner's last word, and nothing is coming to displace it
            reset()
            write(undefined)
          } else {
            run(() => {
              emit(aggregate.derive())
            })
          }
        },
      }
    },
    reset,
  }
}

// An owner has a handful of concurrent operations at most — a display's three
// are the widest case in the tree — so a window past this is an operation that
// took a slot and never retired it, which pins a label up and goes on voting for
// a phase that is over. Silent otherwise, and `ChordVariantDisplay` was in
// exactly that shape from before ADR-081 gave the leak teeth.
const SLOT_LEAK_THRESHOLD = 16
let warnedSlotLeak = false

function warnOnSlotLeak(open: number) {
  if (process.env.NODE_ENV === 'production' || warnedSlotLeak) {
    return
  }
  if (open > SLOT_LEAK_THRESHOLD) {
    warnedSlotLeak = true
    console.error(
      `createStatusWindow: ${open} status streams open on one window. An ` +
        `operation is not calling its stream's clear() — see ADR-081 and ` +
        `agent-docs/reference/PROGRESS_REPORTING.md.`,
    )
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
 * **That skip is not a saving**, which is the opposite of what the shape
 * suggests. Handed an `onProgress`, generic-filehandle2 streams the body into
 * one pre-sized buffer; handed none it calls `res.bytes()` — and in a Chrome
 * worker the streaming read is roughly 1.8x *faster* up to 10MB, giving that
 * back only past ~25MB. So withholding this reporter honors a caller who asked
 * for no reporting; it is never about speed. Numbers and the bench that retakes
 * them:
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
 * Run a download phase whose reader counts its own progress. Shows `label`,
 * hands `fn` the {@link downloadStatusReporter} to pass straight to the
 * reader's `onProgress` (its ticks upgrade the same label to a determinate
 * bar), then clears the status. Combines {@link updateStatus} with the reporter
 * so the label is written in exactly one place — the phase label and the
 * progress label can't drift apart.
 *
 * The unit is whatever the reader counts, and the caller does not have to know
 * which: bytes for the index readers, blocks and expected-value chunks for
 * `@gmod/hic`. All of them report `(current, total?)`.
 *
 * `stopToken` makes the phase a cancellation boundary, exactly as it does on
 * {@link updateStatus} — `fn` is checked on both sides of its await.
 */
export async function downloadStatus<T>(
  label: string,
  statusCallback: StatusCallback | undefined,
  fn: (onProgress: ReturnType<typeof downloadStatusReporter>) => T | Promise<T>,
  stopToken?: StopToken,
): Promise<T> {
  return updateStatus(
    label,
    statusCallback,
    () => fn(downloadStatusReporter(statusCallback, label)),
    stopToken,
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
  /** in-flight slots measuring it this instant */
  live: number
  /** Σ `total` over those, for the mean an unmeasured slot is charged */
  liveTotal: number
  /** position in `phaseRank`; an unseen phase ranks last */
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
 * incommensurable across one, so one phase wins and the rest are charged below
 * (ADR-072). A fan-out whose slots share one phase, the common case, is a plain
 * Σcurrent/Σtotal.
 *
 * **The phase that wins is the earliest one the batch is still in** (ADR-080). A
 * batch is in every phase any of its operations is in — the phase that operation
 * last *reported*, not the one it happens to be measuring this instant — and it
 * leaves one when its LAST operation does. So the label moves forward once per
 * phase, in order, and the bar under it is that phase's own.
 *
 * Rank alone would hand the label to a phase with nothing to say, so a phase the
 * batch has anything to measure in — a reading now, or work already finished —
 * beats one it does not. `phaseRank` is the fan-out's record of first
 * appearance; with none, every phase ranks the same and the choice falls back to
 * slot order.
 *
 * Each slot is then priced against the winning phase on its own, which is why
 * this cannot be a Σ over two flat lists:
 *
 * - measuring it: its own `current`/`total`, plus whatever it already finished
 *   of that phase, in both halves.
 * - not measuring it but having finished some: that finished work in both halves
 *   and **nothing more** — never the mean as well, or the bar falls every time a
 *   region moves on.
 * - neither: in flight with nothing comparable to measure, so charged the mean
 *   of the totals we do know with nothing completed against it. That covers a
 *   response with no Content-Length and a slot in another phase alike; dropping
 *   either outright reads 100% while it is still downloading.
 *
 * A winning phase nothing is measuring right now comes back as its label alone —
 * summing what its slots retired at reads 100% for a batch that is still
 * working, and every slot being between reads is exactly when that happens.
 * {@link createStatusFanOut} re-sends the phase's last real reading instead.
 *
 * A retired slot (`''` or nothing yet) never votes and is never charged the
 * mean; charging it at zero is a bar that runs *backwards* as regions finish.
 * Its finished work still counts, which is what keeps the fraction rising as the
 * batch lands.
 */
export function aggregateStatus(
  slots: StatusSlot[],
  phaseRank: Map<string, number> = new Map(),
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
      // an unseen phase ranks last, and with no record at all every phase ranks
      // the same — which leaves the reduce below keeping its incumbent, the
      // slot-order tie-break
      vote = {
        message,
        live: 0,
        liveTotal: 0,
        rank: phaseRank.get(message) ?? phaseRank.size,
        anyFinished: slots.some(s => finished(s, message) > 0),
      }
      votes.set(message, vote)
    }
    const reading = statusReading(slot.status)
    if (reading !== undefined) {
      vote.live++
      vote.liveTotal += reading.total
    }
  }
  // Whether the phase has anything to measure at all, and then how early the
  // batch reached it. Not how many slots are in it: a count changes hands as
  // regions cross, and the label went back and forth with it.
  const better = (a: PhaseVote, b: PhaseVote) =>
    measurable(a) !== measurable(b) ? measurable(a) : a.rank < b.rank
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
    const reading = statusReading(status)
    if (reading !== undefined && reading.message === message) {
      current += reading.current
      total += reading.total
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
 * **A slot's finished phases are recorded here**, because only a slot's own
 * channel ever sees the total it retired at, and they are what keep a landing
 * batch's bar from walking backwards. A phase is over the moment the slot stops
 * reporting it forward — see {@link continuesPhase}; the `''` it ends on is only
 * one of the ways it can say so.
 *
 * **It never writes `''`.** A slot between two phases and a slot that is done
 * both read as idle from here, so an empty aggregate means "no slot is reporting
 * this instant", not "the batch is over". What goes out is the last label alone,
 * with no bar — which is what that state is. The end of a batch is the owner's
 * to declare (ADR-080): every one of them clears its field when its work ends.
 *
 * Something rather than nothing, because a write that lands is also how a
 * phase's last progress value is *displaced* — statuses are throttled, so a
 * percentage queued behind the window would otherwise fire after the work it
 * measured had ended (ADR-071).
 *
 * **A phase does not lose its bar because nothing is measuring it this
 * instant.** Between reads a slot reports the label alone, and when every slot
 * is between reads at once the aggregate has no measurement — a determinate bar
 * would drop to an indeterminate spinner and return a tick later. The phase's
 * last reading is held and re-sent instead, and dropped the moment the phase
 * changes.
 */
export function createStatusFanOut(statusCallback: StatusCallback | undefined) {
  const aggregate = createStatusAggregate({ holdLastReading: true })
  return (): StatusCallback => {
    const slot = aggregate.add()
    return status => {
      const out = aggregate.update(slot, status)
      if (out !== undefined) {
        statusCallback?.(out)
      }
    }
  }
}

/**
 * Does this reading say the work is finished? A fan-out's aggregate exists only
 * while a slot is in flight, so a full one is never the truth: it is produced by
 * a slot that has retired its read while another is still measuring, and the
 * moment the retired one opens its next read the fraction falls back.
 *
 * So a complete reading is neither held nor shown when there is a real one to
 * show instead; the phase ending is what moves the label on. Not a clamp on the
 * arithmetic — {@link aggregateStatus} still reports what it computes, and a bar
 * that falls because a region *joined* the batch still falls, which is true.
 */
function readsComplete(status: StatusWithProgress) {
  return status.total > 0 && status.current >= status.total
}

/**
 * Is `status` the same determinate phase as `previous`, still running? Only a
 * measurement of the same phase moving forward is; everything else retires it
 * (ADR-080). Three shapes that are easy to miss, and all of them common:
 *
 * - the *enclosing* label a nested phase closes onto — a plain string, not `''`.
 *   The canvas feature fetch is exactly that, an adapter's byte-counted
 *   "Downloading features" inside the RPC's own.
 * - a different phase's label, with no `''` between them.
 * - a measurement moving *backwards* under the same label, which is a second
 *   phase of that name starting at zero. Tabix's redispatch does it when a
 *   feature overhangs the query.
 * - a {@link PhaseFailure}, which retires the phase whatever label it carries.
 */
function continuesPhase(previous: StatusWithProgress, status: RpcStatus) {
  const reading = statusReading(status)
  return (
    reading !== undefined &&
    reading.message === previous.message &&
    reading.current >= previous.current
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
 * throttled cancellation tick, so a loop has exactly one inner callback whether
 * or not it drives the progress UI.
 *
 * Emission is gated on wall-clock time (`throttleMs`) through {@link
 * createTimeGate}, which thins the `Date.now()` reads as well as the emits —
 * see there for why its stride is learned rather than fixed. Keep the loop a
 * plain `for` and call `report()` once per item (it owns the counter), or
 * `report(n)` for an explicit position.
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
  // pessimistic for the same reason as `updateStatus`: a phase that leaves this
  // scope any way other than returning did not finish its work
  let outcome: PhaseOutcome = 'failed'
  try {
    // inside the try, because `report` checks the stop token before it emits and
    // so throws here on a token already stopped. Outside, that threw past the
    // close and left the phase open on the channel — a slot whose last word is a
    // label is one `aggregateStatus` counts as in flight for the rest of the
    // batch.
    report(0)
    const result = await withStopTokenCheck(stopToken, () => fn(report))
    outcome = 'completed'
    return result
  } finally {
    endPhase(outcome)
  }
}
