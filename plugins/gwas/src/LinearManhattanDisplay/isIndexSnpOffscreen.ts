// The subset of LGV `visibleRegions` fields the off-screen test needs.
interface VisibleSpan {
  refName: string
  start: number
  end: number
}

// True when a `chr:bp` index locus falls outside every visible region — the
// benign, pannable cause of a greyed LD plot. PLINK BP is 1-based, so the
// parsed position is shifted to the 0-based block coordinate space before
// comparison. A bare rsID (no parseable position) returns false: we can't place
// it, so we don't claim it's off-screen.
export function isIndexSnpOffscreen(
  indexSnp: string | undefined,
  visibleRegions: VisibleSpan[],
) {
  const parts = indexSnp ? /^(.+):(\d+)$/.exec(indexSnp) : null
  const refName = parts?.[1]
  const pos = parts ? Number(parts[2]) - 1 : 0
  return (
    refName !== undefined &&
    !visibleRegions.some(
      r => r.refName === refName && pos >= r.start && pos < r.end,
    )
  )
}
