// Fails a test run on a contract violation, in any family.
//
// The dev-only checks that report one are listed in
// `agent-docs/reference/ARCHITECTURAL_LIMITS.md` §"Ordering is the contract" —
// don't restate them here, because that list moves and this comment would be the
// stale copy. Two families exist: `display` (compose order, hook placement, the
// dead Retry button) and `session` (a track config written into a list that
// outlives the assembly drawing it — ADR-084).
//
// Each is a `console.error` and never a `throw`, deliberately and permanently:
// an error escaping `afterAttach` is read by the session loader as an invalid
// track and the display is dropped, and a launcher's write sits inside a
// try/catch that reports a failed track — either of which would hide the
// violation being reported. So this changes who *listens*, not what the checks
// do; before it, a violation printed into a run that prints thousands of lines
// and nothing failed.
//
// `console.js` (setupFiles) buffers everything carrying the prefix; this drains
// that buffer after every test and fails if anything is left in it.
//
// **The opt-in is `takeContractReports()`**, a global for the tests that
// provoke a violation on purpose. Taking the messages IS the excuse — the test
// gets the text to assert on, so there is no flag to forget to unset, and no
// filename pattern that would quietly excuse a whole file. A test that only
// wants to allow them calls it and ignores the result.
//
// A test that replaces `console.error`, or spies on it with a mock
// implementation, takes itself out of this gate: nothing reaches the buffer.
// That is the reason the display harnesses in gwas, maf, arc, hic and variants
// silence `console.warn` only, and the reason the four suites that provoke
// violations were moved onto the opt-in rather than left swallowing their own
// reports.

const contract = (globalThis.__jbrowseContract ??= {
  reports: [],
  gated: false,
})
contract.gated = true

function drain() {
  return contract.reports.splice(0, contract.reports.length)
}

globalThis.takeContractReports = drain

function violation(reports, when, caveat) {
  return new Error(
    `${reports.length} contract violation(s) reported ${when}:\n\n` +
      reports.map(report => `  ${report}`).join('\n\n') +
      `\n\n${caveat}\n\nThese checks report through console.error and never ` +
      `throw, so this gate is the only thing that fails on them. Fix the ` +
      `code the message names; if the violation is provoked on purpose, take ` +
      `the reports with ` +
      `takeContractReports() and assert on them.`,
  )
}

afterEach(() => {
  const reports = drain()
  if (reports.length > 0) {
    throw violation(
      reports,
      'while this test ran',
      // Attribution is best-effort in exactly one direction, and saying so beats
      // being confidently wrong: a check that fires from a debounced autorun can
      // land after the test body returned, in which case the named test is the
      // one that ran NEXT. Nothing here can tell those apart, so the message
      // does not pretend to.
      'If the check fires from an autorun it may have been provoked by the ' +
        'test before this one — these run after the body returns.',
    )
  }
})

afterAll(() => {
  const reports = drain()
  if (reports.length > 0) {
    throw violation(
      reports,
      'after the last test in this file finished',
      'Nothing can attribute these to a test, so they fail the file instead.',
    )
  }
})
