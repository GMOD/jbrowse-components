export function parseError(str: string) {
  let snapshotError = ''
  let message = ''
  const findStr = 'is not assignable'
  const idx = str.indexOf(findStr)
  if (idx !== -1) {
    const trim = str.slice(0, idx + findStr.length)
    // best effort to make a better error message than the default
    // @jbrowse/mobx-state-tree

    // case 1. element has a path
    const match = /.*at path "(.*)" snapshot `(.*)` is not assignable/m.exec(
      trim,
    )
    // case 2. element has no path
    const match2 = /.*snapshot `(.*)` is not assignable/.exec(trim)
    if (match) {
      snapshotError = match[2]!
      message = `Failed to load element at ${match[1]}...Failed element had snapshot`
    } else if (match2) {
      snapshotError = match2[1]!
      message = 'Failed to load element...Failed element had snapshot'
    }
  }
  return { snapshotError, message }
}
