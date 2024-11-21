const originalError = console.error

jest.spyOn(console, 'error').mockImplementation((...args) => {
  const r = String(args)
  if (
    r.includes('volvox.2bit_404') ||
    r.includes('popupState') ||
    r.includes("Can't perform a React state update on an unmounted") ||
    r.includes('Unexpected return value from a callback ref') ||
    r.includes('A suspended resource finished loading inside a test') ||
    r.includes('was not wrapped in act')
  ) {
    return undefined
  }

  originalError.call(console, ...args)
})
