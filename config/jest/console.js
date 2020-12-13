const originalError = console.error
const originalWarn = console.warn

// this is here to silence a warning related to useStaticRendering
// xref https://github.com/GMOD/jbrowse-components/issues/1277
jest.spyOn(console, 'error').mockImplementation((...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useLayoutEffect')) {
    return undefined
  }
  return originalError.call(console, args)
})

// this is here to silence a warning related to useResizeContainer for @material-ui/data-grid
jest.spyOn(console, 'warn').mockImplementation((...args) => {
  if (typeof args[0] === 'string' && args[0].includes('useResizeContainer')) {
    return undefined
  }
  return originalWarn.call(console, args)
})
