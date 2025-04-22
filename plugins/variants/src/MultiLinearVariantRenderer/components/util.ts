export function minElt<T>(arr: Iterable<T>, cb: (arg: T) => number) {
  let min = Infinity
  let minElement: T | undefined
  for (const entry of arr) {
    const val = cb(entry)

    if (val < min) {
      min = val
      minElement = entry
    }
  }
  return minElement
}
