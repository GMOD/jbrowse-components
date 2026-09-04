const originalError = console.error
const originalWarn = console.warn

// The dev-only contract checks all report through `console.error` under a prefix
// of this shape and deliberately never throw — an error escaping `afterAttach`
// is read by the session loader as an invalid track and the display is silently
// dropped, and a launcher's write is inside a try/catch that reports a failed
// track, either of which would hide the very violation being reported. So the
// run has to listen instead of the check being louder: every message carrying
// the prefix is buffered here, and `contractGate.js` (setupFilesAfterEnv) fails
// the test that collected it.
//
// A FAMILY of prefixes rather than one literal, because the mechanism was never
// about displays: `display`, `session` and `figure` exist today. A new family
// needs no change here, which is the point — the alternative is a check that
// mislabels itself to reach the gate. `\w+`, so a family name carries no hyphen.
const CONTRACT_PREFIX = /\[jbrowse \w+ contract]/

// An exception thrown out of an `autorun`/`reaction` body is caught by MobX and
// reported here, never rethrown, so a reaction that throws on every pass leaves
// a suite green. That is not a family of ours, but it is the same failure: a
// report nothing listens to. The synteny shared-scale clamp threw four times in
// one file for as long as it was in the tree.
//
// A test that provokes one on purpose takes it with `takeContractReports()`,
// the same opt-in the contract families use.
const MOBX_REACTION_ERROR = '[mobx] Encountered an uncaught exception'

// Shared with the gate, which runs later in the same context. `gated` is set
// there, and printing is suppressed only once it is: a project that somehow has
// this shim without the gate stays exactly as loud as before rather than going
// quieter than it was.
const contract = (globalThis.__jbrowseContract ??= {
  reports: [],
  gated: false,
})

console.error = (...args) => {
  const message = args.map(a => `${a}`).join(' ')
  if (CONTRACT_PREFIX.test(message) || message.includes(MOBX_REACTION_ERROR)) {
    contract.reports.push(message)
    if (contract.gated) {
      // the gate quotes it verbatim in the failure it throws, so printing here
      // would duplicate it — with a jest stack trace attached, which reads as a
      // failing suite even in the tests that provoke a violation on purpose
      return undefined
    }
  }
  if (
    message.includes('popupState') ||
    message.includes('Unterminated') ||
    message.includes('Cannot update a component') ||
    message.includes('was not wrapped in act') ||
    message.includes('Only HTTP(S) protocols are supported') ||
    message.includes(
      'You are trying to `require` a file outside of the scope of the test code',
    )
  ) {
    return undefined
  }
  originalError.call(console, ...args)
}

console.warn = (...args) => {
  const r = String(args)
  if (
    r.includes('The `anchorEl` prop provided to the component is invalid') ||
    r.includes('[GPU] WebGPU initialization failed') ||
    r.includes('[GPU] WebGPU device ready') ||
    r.includes('[GPU] WebGL2 unavailable, falling back to Canvas2D') ||
    r.includes('[GPU] WebGPU not supported in this browser') ||
    r.includes('] init (live=') ||
    r.includes('LD coloring: index SNP') ||
    // add-track.test.ts: 'adds bam track with all the custom fields' passes an
    // unregistered --assemblyNames value on purpose to exercise custom-field handling
    r.includes('assembly name(s) not found in config') ||
    // applyTrackOpts.test.ts: 'an unknown heightMode is ignored' passes
    // heightMode:bogus on purpose to verify it's ignored
    r.includes('unknown heightMode')
  ) {
    return undefined
  }
  originalWarn.call(console, ...args)
}
