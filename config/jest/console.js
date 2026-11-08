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

// Run-wide on purpose, because no one test is the cause and a spy in every
// suite that hits them would assert nothing about that suite:
//
// - React's act() warnings. About 120 suites, nearly all jbrowse-web's, render
//   a tree that MobX re-renders as data arrives; React's test mode asks for
//   every such update to sit inside act(), which an async model update cannot.
// - The GPU backend ladder's once-per-device diagnostics. jsdom has neither
//   WebGPU nor WebGL2, so every suite that mounts a display steps down to
//   Canvas2D and says so, and every suite that installs a fake or Dawn device
//   reports what it got.
//
// Everything else a test prints is that test's to spy on and assert.
const actWarning = /not wrapped in act\(/
const gpuLadder = [
  '[GPU] WebGPU not supported in this browser',
  '[GPU] WebGL2 unavailable, falling back to Canvas2D',
  '[GPU] WebGPU device ready',
]

// Contract reports never reach this: `contractGate.js` (setupFilesAfterEnv)
// wraps console.error after this file does and buffers them first.
console.error = (...args) => {
  if (!actWarning.test(`${args[0]}`)) {
    print('error', originalError, args)
  }
}

console.warn = (...args) => {
  const message = `${args[0]}`
  if (!gpuLadder.some(line => message.startsWith(line))) {
    print('warn', originalWarn, args)
  }
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
