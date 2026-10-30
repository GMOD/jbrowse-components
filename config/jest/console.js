const originalError = console.error
const originalWarn = console.warn

// Contract reports never reach this: `contractGate.js` (setupFilesAfterEnv)
// wraps console.error after this file does and buffers them first.
console.error = (...args) => {
  const message = args.map(a => `${a}`).join(' ')
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
