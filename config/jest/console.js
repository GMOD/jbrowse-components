const originalError = console.error.bind(console)
const originalWarn = console.warn.bind(console)

console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('volvox.2bit_404') ||
      args[0].includes('indexedDB') ||
      args[0].includes('popupState') ||
      args[0].includes('Cannot update a component') ||
      args[0].includes('was not wrapped in act') ||
      args[0].includes('Only HTTP(S) protocols are supported'))
  ) {
    return undefined
  }

  originalError(...args)
}

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes(
      'The `anchorEl` prop provided to the component is invalid',
    ) ||
      args[0].includes('unable to determine size of file'))
  ) {
    return undefined
  }

  originalWarn(...args)
}
