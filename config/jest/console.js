const originalError = console.error

jest.spyOn(console, 'error').mockImplementation((...args) => {
  const r = String(args)
  if (
    r.includes('volvox.2bit_404') ||
    r.includes('indexedDB') ||
    r.includes('popupState') ||
    r.includes('Cannot update a component') ||
    r.includes('was not wrapped in act') ||
    r.includes('Only HTTP(S) protocols are supported')
  ) {
    return undefined
  }

  originalError.call(console, ...args)
})
