const originalError = console.error
const originalWarn = console.warn
const originalLog = console.log
const originalInfo = console.info
const originalDebug = console.debug

// What got past the filters below, for consoleGate.js to fail the test on.
// It is printed as well, so the gate's failure sits under the usual location.
const printed = []
globalThis.takePrintedConsole = () => printed.splice(0)

function print(level, sink, args) {
  printed.push(`console.${level}: ${args.map(a => `${a}`).join(' ')}`)
  sink.call(console, ...args)
}

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
  print('error', originalError, args)
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
  print('warn', originalWarn, args)
}

console.log = (...args) => {
  print('log', originalLog, args)
}
console.info = (...args) => {
  print('info', originalInfo, args)
}
console.debug = (...args) => {
  print('debug', originalDebug, args)
}
