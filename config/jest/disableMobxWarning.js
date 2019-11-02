// filter mobx-state-tree onAction warning
const originalWarn = console.warn
console.warn = (...args) => {
  if (/onAction/.test(args[0])) {
    return
  }
  originalWarn.call(console, ...args)
}
