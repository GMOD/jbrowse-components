// Fails a test run on a display-contract violation.
//
// Five dev-only checks report one — `assertDisplayContract` (`isCacheValid` /
// `rpcProps` declared in `.actions()`, and the double-install from chaining to
// super in `afterAttach`), `makeRetryContractCheck` (the dead Retry button),
// `HeightModeMixin`'s and `CanvasFeatureGateMixin`'s compose-order self-checks,
// and `RegionTooLargeMixin`'s renamed-hook map. Each is a `console.error` and
// never a `throw`, deliberately and permanently: an error escaping `afterAttach`
// is read by the session loader as an invalid track and the display is dropped,
// which would hide the violation being reported. So this changes who *listens*,
// not what the checks do — before it, a violation printed into a run that prints
// thousands of lines and nothing failed.
//
// `console.js` (setupFiles) buffers everything carrying the prefix; this drains
// that buffer after every test and fails if anything is left in it.
//
// **The opt-in is `takeDisplayContractReports()`**, a global for the tests that
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

const displayContract = (globalThis.__jbrowseDisplayContract ??= {
  reports: [],
  gated: false,
})
displayContract.gated = true

function drain() {
  return displayContract.reports.splice(0, displayContract.reports.length)
}

globalThis.takeDisplayContractReports = drain

function violation(reports, when, caveat) {
  return new Error(
    `${reports.length} display-contract violation(s) reported ${when}:\n\n` +
      reports.map(report => `  ${report}`).join('\n\n') +
      `\n\n${caveat}\n\nThese checks report through console.error and never ` +
      `throw, so this gate is the only thing that fails on them. Fix the ` +
      `display; if the violation is provoked on purpose, take the reports with ` +
      `takeDisplayContractReports() and assert on them.`,
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
