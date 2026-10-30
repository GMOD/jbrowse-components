// Fails a test run on a contract violation, in any family.
//
// The dev-only checks report through `console.error` under a
// `[jbrowse <family> contract]` prefix and never throw: an error escaping
// `afterAttach` is read by the session loader as an invalid track and the
// display is dropped, and a launcher's write sits inside a try/catch that
// reports a failed track, either of which would hide the violation. So the run
// has to listen instead. This buffers every message carrying the prefix and
// fails the test that collected it.
//
// MobX catches an exception thrown out of an `autorun`/`reaction` body and
// reports it here rather than rethrowing, so a reaction that throws on every
// pass leaves a suite green. It is the same failure, so it is gated the same
// way.
//
// A test that provokes either on purpose calls `takeContractReports()`: taking
// the messages is the excuse, so there is no flag to forget to unset. A test
// that replaces `console.error` takes itself out of the gate.

interface TestHooks {
  afterEach: (fn: () => void) => void
  afterAll: (fn: () => void) => void
}

const CONTRACT_PREFIX = /\[jbrowse \w+ contract]/
const MOBX_REACTION_ERROR = '[mobx] Encountered an uncaught exception'

const reports: string[] = []

export function takeContractReports() {
  return reports.splice(0)
}

function violation(taken: string[], when: string, caveat: string) {
  const listed = taken.map(report => `  ${report}`).join('\n\n')
  return new Error(
    `${taken.length} contract violation(s) reported ${when}:\n\n${listed}\n\n${caveat}\n\n` +
      'These checks report through console.error and never throw, so this ' +
      'gate is the only thing that fails on them. Fix the code the message ' +
      'names; if the violation is provoked on purpose, take the reports with ' +
      'takeContractReports() and assert on them.',
  )
}

/**
 * Call once from a test setup file with the runner's hooks:
 * `installContractGate({ afterEach, afterAll })`, imported from `vitest` or
 * read off jest's globals.
 */
export function installContractGate({ afterEach, afterAll }: TestHooks) {
  const forward = console.error
  console.error = (...args: unknown[]) => {
    const message = args.map(a => `${a}`).join(' ')
    if (
      CONTRACT_PREFIX.test(message) ||
      message.includes(MOBX_REACTION_ERROR)
    ) {
      reports.push(message)
    } else {
      forward.call(console, ...args)
    }
  }
  afterEach(() => {
    const taken = takeContractReports()
    if (taken.length > 0) {
      throw violation(
        taken,
        'while this test ran',
        // a check firing from a debounced autorun can land after the body
        // returned, and then the named test is the one that ran next
        'If the check fires from an autorun it may have been provoked by the ' +
          'test before this one — these run after the body returns.',
      )
    }
  })
  afterAll(() => {
    const taken = takeContractReports()
    if (taken.length > 0) {
      throw violation(
        taken,
        'after the last test in this file finished',
        'Nothing can attribute these to a test, so they fail the file instead.',
      )
    }
  })
}
