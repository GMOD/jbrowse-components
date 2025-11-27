// Inline min/max for 4 values to avoid function call overhead
export function max4(a: number, b: number, c: number, d: number) {
  let m = a
  if (b > m) {
    m = b
  }
  if (c > m) {
    m = c
  }
  if (d > m) {
    m = d
  }
  return m
}

export function min4(a: number, b: number, c: number, d: number) {
  let m = a
  if (b < m) {
    m = b
  }
  if (c < m) {
    m = c
  }
  if (d < m) {
    m = d
  }
  return m
}
