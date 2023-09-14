const originalWarn = console.warn
const originalError = console.error

jest.spyOn(console, 'error').mockImplementation((...args) => {
  if (String(args[0]).includes('volvox.2bit_404')) {
    return undefined
  }

  if (String(args).includes('popupState')) {
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

  return originalError.call(console, ...args)
})
