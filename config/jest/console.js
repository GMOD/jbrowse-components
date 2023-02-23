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

  if (String(args).includes('popupState')) {
    return undefined
  }

  if (String(args).includes('hydrateRoot')) {
    return undefined
  }
  if (
    String(args).includes(
      "Can't perform a React state update on an unmounted component.",
    )
  ) {
    return undefined
  }

  if (
    String(args).includes('A suspended resource finished loading inside a test')
  ) {
    return undefined
  }

  if (String(args).includes('was not wrapped in act')) {
    return undefined
  }
  if (
    String(args).includes(
      'attempting to unmount was rendered by another copy of React',
    )
  ) {
    return undefined
  }

  return originalError.call(console, ...args)
})
