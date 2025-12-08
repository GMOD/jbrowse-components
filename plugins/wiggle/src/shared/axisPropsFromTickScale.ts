import type { ScaleLinear, ScaleQuantize } from '@mui/x-charts-vendor/d3-scale'

export default function axisPropsFromTickScale(
  scale: ScaleLinear<number, number> | ScaleQuantize<number>,
  tickCount: number,
) {
  const range = scale.range()
  const values = scale.ticks(tickCount)
  const format = scale.tickFormat(tickCount)
  const position = scale.copy()

  return {
    range,
    values,
    format,
    position,
  }
}
