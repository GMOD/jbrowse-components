const inProgress = new WeakSet()

module.exports = {
  test: val => val?.nodeType === 1 && !inProgress.has(val),
  serialize: (val, config, indentation, depth, refs, printer) => {
    inProgress.add(val)
    try {
      return printer(val, config, indentation, depth, refs).replaceAll(
        /\bcss-[a-z0-9]+/g,
        'css-HASH',
      )
    } finally {
      inProgress.delete(val)
    }
  },
}
