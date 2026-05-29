const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

console.log = (...args) => {
  const r = String(args)
  if (r.includes('SharedArrayBuffer available, using fast atomic abort')) {
    return undefined
  }
  originalLog.call(console, ...args)
}

console.error = (...args) => {
  const r = String(args)
  if (
    r.includes('indexedDB') ||
    r.includes('popupState') ||
    r.includes('Cannot update a component') ||
    r.includes('was not wrapped in act') ||
    r.includes('Only HTTP(S) protocols are supported')
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
    r.includes('[GPU] WebGL2 unavailable, falling back to Canvas2D') ||
    r.includes('[GPU] WebGPU not supported in this browser') ||
    r.includes('] init (live=')
  ) {
    return undefined
  }
  originalWarn.call(console, ...args)
}
