/** The power of two `bpPerPx` rounds to, so a zoom re-fades once per doubling */
export function densityRung(bpPerPx: number) {
  return 2 ** Math.round(Math.log2(bpPerPx))
}

// How opaque a pixel draws when every record over it is alt for the row
export const DENSE_OPACITY = 0.9

// Past this many pixel columns the records are too sparse to share a pixel
const MAX_COLUMNS = 1 << 20

/**
 * Each record's alpha factor where records share pixels on screen, or undefined
 * where none do. A record drawn over pixels that hold at most `n` records draws
 * at `1 - (1 - DENSE_OPACITY) ** (1 / n)`, so a row's pixel over which every
 * record is alt reaches `DENSE_OPACITY`, and one over which a share of them are
 * reaches `1 - (1 - DENSE_OPACITY) ** share`: the shade tracks the share of alt
 * records under the pixel instead of whether any is. A record's drawn span is
 * its bp span at `bpPerPx`, floored at the 2 px a cell draws.
 */
export function recordDensityAlpha(
  featurePositions: Uint32Array,
  bpPerPx: number,
) {
  const n = featurePositions.length / 2
  if (n < 2 || !(bpPerPx > 0)) {
    return undefined
  }
  let min = Infinity
  let max = 0
  for (let f = 0; f < n; f++) {
    min = Math.min(min, featurePositions[2 * f]!)
    max = Math.max(max, featurePositions[2 * f + 1]!)
  }
  const columns = Math.ceil((max - min) / bpPerPx) + 3
  if (columns > MAX_COLUMNS) {
    return undefined
  }
  const spanOf = (f: number) => {
    const x1 = Math.floor((featurePositions[2 * f]! - min) / bpPerPx)
    const x2 = Math.max(
      x1 + 2,
      Math.ceil((featurePositions[2 * f + 1]! - min) / bpPerPx),
    )
    return [x1, x2] as const
  }
  const cover = new Uint32Array(columns)
  let shared = false
  for (let f = 0; f < n; f++) {
    const [x1, x2] = spanOf(f)
    for (let x = x1; x < x2; x++) {
      cover[x]!++
      if (cover[x]! > 1) {
        shared = true
      }
    }
  }
  if (!shared) {
    return undefined
  }
  const alpha = new Float32Array(n)
  const clear = 1 - DENSE_OPACITY
  for (let f = 0; f < n; f++) {
    const [x1, x2] = spanOf(f)
    let most = 1
    for (let x = x1; x < x2; x++) {
      most = Math.max(most, cover[x]!)
    }
    alpha[f] = most > 1 ? 1 - clear ** (1 / most) : 1
  }
  return alpha
}

/**
 * `colors` with each cell's alpha scaled by its record's factor; the same
 * array when there is none
 */
export function fadeCellColors(
  colors: Uint32Array,
  cellFeatureIndices: ArrayLike<number>,
  numCells: number,
  alpha: Float32Array | undefined,
) {
  if (!alpha) {
    return colors
  }
  const out = colors.slice()
  for (let i = 0; i < numCells; i++) {
    const a = alpha[cellFeatureIndices[i]!]!
    if (a < 1) {
      const c = out[i]!
      out[i] =
        (((Math.round((c >>> 24) * a) & 0xff) << 24) | (c & 0xffffff)) >>> 0
    }
  }
  return out
}
