export function drawStackedBars(
  ctx: CanvasRenderingContext2D,
  entries: Record<string, { entryDepth: number }>,
  colorMap: Record<string, string>,
  x: number,
  bottom: number,
  w: number,
  h: number,
  depth: number,
  startCurr: number,
) {
  let curr = startCurr
  for (const base in entries) {
    const { entryDepth } = entries[base]!
    ctx.fillStyle = colorMap[base] || 'black'
    ctx.fillRect(
      x,
      bottom - ((entryDepth + curr) / depth) * h,
      w,
      (entryDepth / depth) * h,
    )
    curr += entryDepth
  }
  return curr
}
