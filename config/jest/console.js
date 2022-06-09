const originalWarn = console.warn
const originalError = console.error

// this is here to silence a warning related to @material-ui/data-grid
// not precisely sure why it warns but this error is silenced during test
jest.spyOn(console, 'warn').mockImplementation((...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useResizeContainer')) {
    return undefined
  }
  return originalWarn.call(console, ...args)
})

jest.spyOn(console, 'error').mockImplementation((...args) => {
  if (String(args[0]).includes('volvox.2bit_404')) {
    return undefined
  }
  if (
    String(args[0]).includes(
      'ReactDOM.render is no longer supported in React 18',
    )
  ) {
    return undefined
  }
  if (
    String(args[0]).includes(
      'ReactDOM.hydrate is no longer supported in React 18',
    )
  ) {
    return undefined
  }
  return originalError.call(console, ...args)
})
