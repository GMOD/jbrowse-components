// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

/**
 * A contract family — the `<family>` in the `[jbrowse <family> contract]`
 * prefix every contract check in the tree reports under.
 * `config/jest/console.js` matches `\w+`, so a new one reaches the test gate
 * without touching it.
 */
export type ContractFamily = 'display' | 'session' | 'figure'

export interface ContractReport {
  family: ContractFamily
  message: string
  /** what armed the channel, so a host can say why it is showing this */
  armedBy: string
}

const DEVELOPER_MODE_KEY = 'jbrowseDeveloperMode'

// The flag a plugin author can set on any deployed JBrowse without owning it or
// asking anyone, which is the population this whole channel is for.
function storageFlag() {
  try {
    return typeof localStorage === 'undefined' ||
      localStorage.getItem(DEVELOPER_MODE_KEY) === null
      ? undefined
      : `localStorage.${DEVELOPER_MODE_KEY} is set`
  } catch {
    // storage can be denied outright, and a diagnostic is not the thing to take
    // the app down with
    return undefined
  }
}

// Module scope for the same reason `numberGrouping` is: a check is called from
// a mixin factory, an MST action and a React effect that cannot share a
// closure, and each realm resolves this once at startup rather than through an
// observable a worker could not see.
let armedBy =
  process.env.NODE_ENV === 'production'
    ? storageFlag()
    : 'this is a development build'

let sink: ((report: ContractReport) => void) | undefined

// A report has two consumers and they arrive at different moments, so it waits
// for each in its own queue. `unlogged` holds what was found before anything
// armed the channel; `undelivered` holds what was found before a host had a
// sink to show it in — and that one is the ordering every attach-time check
// actually runs in, because MST attaches a display BEFORE the session that
// contains it. Dropping either would leave the notification permanently blind
// to the class of violation it was written for.
//
// Bounded because a queue nobody ever drains is a leak: a violation repeats per
// display, and the first twenty say everything the twenty-first would.
type Found = Omit<ContractReport, 'armedBy'>

const unlogged: Found[] = []
const undelivered: Found[] = []
const PENDING_LIMIT = 20

function remember(queue: Found[], found: Found) {
  if (queue.length < PENDING_LIMIT) {
    queue.push(found)
  }
}

/**
 * Whether the checks should run at all.
 *
 * Read it where a check costs something to run — the `MutationObserver` a live
 * figure installs, the per-frame payload walk in `installUpload`. A check whose
 * cost is a `WeakSet` lookup should run unconditionally and report through
 * {@link reportContractViolation} instead, so that arming the channel late
 * still surfaces what it found.
 */
export function contractReportsOn() {
  return armedBy !== undefined
}

/**
 * Turn the channel on in a production build, saying what turned it on.
 *
 * The reason is not decoration: a notification that appears in an app the
 * reader did not build has to answer "why am I seeing this" in its own text, or
 * it reads as the app being broken rather than as a plugin being under
 * development. First caller wins, so the earliest evidence is the one quoted.
 */
export function enableContractReports(reason: string) {
  armedBy ??= reason
  for (const found of unlogged.splice(0, unlogged.length)) {
    emit(found, armedBy)
  }
}

/**
 * Where a host puts contract violations that reach a user — a session
 * notification in the apps. Installing one drains whatever was found before the
 * host existed, and the disposer only clears the sink it installed, so a
 * session torn down after its replacement was built does not take the live
 * one's sink with it.
 */
export function setContractReportSink(fn: (report: ContractReport) => void) {
  sink = fn
  if (armedBy !== undefined) {
    for (const found of undelivered.splice(0, undelivered.length)) {
      fn({ ...found, armedBy })
    }
  }
  return () => {
    if (sink === fn) {
      sink = undefined
    }
  }
}

function emit(found: Found, armed: string) {
  // `console.error`, never a throw: an error escaping `afterAttach` is read by
  // the session loader as an invalid track and the display is silently dropped,
  // which would hide the very violation being reported. The prefix is what
  // `config/jest/console.js` buffers and `contractGate.js` fails a test on.
  console.error(`[jbrowse ${found.family} contract] ${found.message}`)
  if (sink === undefined) {
    remember(undelivered, found)
  } else {
    sink({ ...found, armedBy: armed })
  }
}

/**
 * Report a violation of an ordering contract no type can state.
 *
 * In tree this is the `console.error` it has always been, and the jest gate is
 * what listens. Out of tree it is the only thing that reaches a plugin author
 * at all: their display runs in a production build of somebody's app, which
 * strips nothing here, and a violation surfaces the moment anything arms the
 * channel — a `localStorage` flag, a plugin loaded from localhost, or a site
 * whose config asks for it.
 *
 * `agent-docs/reference/ARCHITECTURAL_LIMITS.md` §"Ordering is the contract" is
 * the register of what reports here.
 */
export function reportContractViolation(
  family: ContractFamily,
  message: string,
) {
  if (armedBy === undefined) {
    remember(unlogged, { family, message })
  } else {
    emit({ family, message }, armedBy)
  }
}
