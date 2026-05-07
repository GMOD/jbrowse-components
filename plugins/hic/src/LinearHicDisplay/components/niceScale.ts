import { scaleLinear, scaleLog } from '@mui/x-charts-vendor/d3-scale'

export function getNiceScale(maxScore: number, useLogScale?: boolean) {
  if (useLogScale) {
    const scale = scaleLog().base(2).domain([1, maxScore]).nice()
    const [min, max] = scale.domain()
    return { min, max }
  }
  const scale = scaleLinear().domain([0, maxScore]).nice()
  const [min, max] = scale.domain()
  return { min, max }
}
