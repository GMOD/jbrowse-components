import { scaleLinear, scaleLog } from '@mui/x-charts-vendor/d3-scale'

export function getNiceScale(maxScore: number, useLogScale?: boolean) {
  if (useLogScale) {
    // scaleLog needs a domain strictly inside its base, so guard against
    // degenerate KR-normalized data where the top count is < 2.
    const scale = scaleLog()
      .base(2)
      .domain([1, Math.max(2, maxScore)])
      .nice()
    const [min, max] = scale.domain()
    return { min, max }
  }
  const scale = scaleLinear().domain([0, maxScore]).nice()
  const [min, max] = scale.domain()
  return { min, max }
}
