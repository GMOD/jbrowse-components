const originalWarn = console.warn

// this is here to silence a warning related to @material-ui/data-grid
// not precisely sure why it warns but this error is silenced during test
jest.spyOn(console, 'warn').mockImplementation((...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useResizeContainer')) {
    return undefined
  }
  return originalWarn.call(console, args)
})
