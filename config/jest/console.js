const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

console.log = (...args) => {
  const r = String(args)
  if (
    r.includes('SharedArrayBuffer available, using fast atomic abort') ||
    r.includes('[GPU]')
  ) {
    return undefined
  }

  originalLog.call(console, ...args)
}

console.error = (...args) => {
  const r = String(args)
  if (
    r.includes('volvox.2bit_404') ||
    r.includes('indexedDB') ||
    r.includes('popupState') ||
    r.includes('Cannot update a component') ||
    r.includes('was not wrapped in act') ||
    r.includes('Only HTTP(S) protocols are supported') ||
    r.includes('[GPU]')
  ) {
    return undefined
  }

  originalError.call(console, ...args)
}

console.warn = (...args) => {
  const r = String(args)
  if (
    r.includes('The `anchorEl` prop provided to the component is invalid') ||
    r.includes('[GPU]') ||
    r.includes('WebGL2Hal')
  ) {
    return undefined
  }

  originalWarn.call(console, ...args)
}
