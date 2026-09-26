/** A stretch of a chromosome and the colour it is painted, in its own coordinates. */
export interface PaintRun {
  start: number
  end: number
  color: string
}

/**
 * A region's ideogram painted by what aligns to it, one run per stretch of
 * bins that share a colour. Each bin of `bpPerBin` takes the colour covering
 * most of its bases, and a bin nothing covers is left out, so the runs are as
 * many as the colour changes along the region at that resolution however many
 * spans went in.
 */
export function paintRuns(
  spans: readonly PaintRun[],
  region: { start: number; end: number },
  bpPerBin: number,
): PaintRun[] {
  const width = region.end - region.start
  if (!spans.length || width <= 0 || !(bpPerBin > 0)) {
    return []
  }
  const colors = [...new Set(spans.map(s => s.color))]
  const colorIndex = new Map(colors.map((c, i) => [c, i]))
  const k = colors.length
  const bins = Math.ceil(width / bpPerBin)
  const cover = new Float64Array(bins * k)
  for (const { start, end, color } of spans) {
    const s = Math.max(start, region.start) - region.start
    const e = Math.min(end, region.end) - region.start
    const ci = colorIndex.get(color)!
    for (let b = Math.floor(s / bpPerBin); b < bins && b * bpPerBin < e; b++) {
      const overlap =
        Math.min(e, (b + 1) * bpPerBin) - Math.max(s, b * bpPerBin)
      if (overlap > 0) {
        cover[b * k + ci]! += overlap
      }
    }
  }
  const runs: PaintRun[] = []
  let previous = -1
  for (let b = 0; b < bins; b++) {
    let best = -1
    let bestCover = 0
    for (let c = 0; c < k; c++) {
      const v = cover[b * k + c]!
      if (v > bestCover) {
        best = c
        bestCover = v
      }
    }
    const end = Math.min(region.end, region.start + (b + 1) * bpPerBin)
    if (best >= 0 && best === previous) {
      runs.at(-1)!.end = end
    } else if (best >= 0) {
      runs.push({
        start: region.start + b * bpPerBin,
        end,
        color: colors[best]!,
      })
    }
    previous = best
  }
  return runs
}
