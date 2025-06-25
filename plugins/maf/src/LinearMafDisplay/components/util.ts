export function max(arr: number[], init = Number.NEGATIVE_INFINITY) {
  let max = init
  for (const entry of arr) {
    max = Math.max(entry, max)
  }
  return max
}
