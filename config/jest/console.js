const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

// The dev-only display-contract checks all report through `console.error` under
// this prefix and deliberately never throw — an error escaping `afterAttach` is
// read by the session loader as an invalid track and the display is silently
// dropped, which would hide the very violation being reported. So the run has to
// listen instead of the check being louder: every message carrying the prefix is
// buffered here, and `displayContractGate.js` (setupFilesAfterEnv) fails the test
// that collected it.
const DISPLAY_CONTRACT_PREFIX = '[jbrowse display contract]'

// Shared with the gate, which runs later in the same context. `gated` is set
// there, and printing is suppressed only once it is: a project that somehow has
// this shim without the gate stays exactly as loud as before rather than going
// quieter than it was.
const displayContract = (globalThis.__jbrowseDisplayContract ??= {
  reports: [],
  gated: false,
})

console.log = (...args) => {
  const r = String(args)
  if (r.includes('SharedArrayBuffer available, using fast atomic abort')) {
    return undefined
  }
  originalLog.call(console, ...args)
}

console.error = (...args) => {
  const message = args.map(a => `${a}`).join(' ')
  if (message.includes(DISPLAY_CONTRACT_PREFIX)) {
    displayContract.reports.push(message)
    if (displayContract.gated) {
      // the gate quotes it verbatim in the failure it throws, so printing here
      // would duplicate it — with a jest stack trace attached, which reads as a
      // failing suite even in the tests that provoke a violation on purpose
      return undefined
    }
  }
  const r = String(args)
  if (
    r.includes('popupState') ||
    r.includes('Unterminated') ||
    r.includes('Cannot update a component') ||
    r.includes('was not wrapped in act') ||
    r.includes('Only HTTP(S) protocols are supported') ||
    r.includes(
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
