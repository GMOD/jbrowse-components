export function drawCrossHatches(
  ctx: CanvasRenderingContext2D,
  ticks: { values: number[] },
  width: number,
  toY: (n: number) => number,
) {
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(140,140,140,0.8)'
  for (const tick of ticks.values) {
    ctx.beginPath()
    ctx.moveTo(0, Math.round(toY(tick)))
    ctx.lineTo(width, Math.round(toY(tick)))
    ctx.stroke()
  }
}
