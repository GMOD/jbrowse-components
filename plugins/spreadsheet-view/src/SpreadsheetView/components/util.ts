function letterFor(n: number) {
  return String.fromCharCode(n + 65)
}

export function numToColName(num: number) {
  if (num >= 0) {
    if (num < 26) {
      return letterFor(num)
    }
    if (num < 27 * 26) {
      return letterFor(Math.floor(num / 26 - 1)) + letterFor(num % 26)
    }
  }

  throw new RangeError('column number out of range')
}
