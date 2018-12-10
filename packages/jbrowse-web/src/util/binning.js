function lshift(num, bits) {
  return num * 2 ** bits
}
function rshift(num, bits) {
  return Math.floor(num / 2 ** bits)
}

/* calculate bin given an alignment covering [beg,end) (zero-based, half-close-half-open) */
export function canonicalBinForRegion(region, minShift, depth) {
  const { start } = region
  let { end } = region
  end -= 1
  let l = depth

  let s = minShift

  let t = (lshift(1, depth * 3) - 1) / 7
  for (; l > 0; l -= 1, s += 3, t -= lshift(1, l * 3))
    if (rshift(start, s) === rshift(end, s)) return t + rshift(start, s)
  return 0
}

/* calculate the list of bins that may overlap with region [beg,end) (zero-based) */
export function binsOverlappingRegion(region, minShift, depth, binLimit) {
  let { start: beg, end } = region
  beg -= 1 // < convert to 1-based closed
  if (beg < 1) beg = 1
  if (end > 2 ** 50) end = 2 ** 34 // 17 GiB ought to be enough for anybody
  end -= 1
  let l = 0
  let t = 0
  let s = minShift + depth * 3
  const bins = []
  for (; l <= depth; s -= 3, t += lshift(1, l * 3), l += 1) {
    const b = t + rshift(beg, s)
    const e = t + rshift(end, s)
    if (e - b + bins.length > binLimit)
      throw new Error(
        `query ${beg}-${end} is too large for current binning scheme (shift ${minShift}, depth ${depth}), try a smaller query or a coarser index binning scheme`,
      )
    for (let i = b; i <= e; i += 1) bins.push(i)
  }
  return bins
}
