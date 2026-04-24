import { observer } from 'mobx-react'

import YScaleBar from './YScaleBar.tsx'

export interface CoverageTicks {
  ticks: { value: number; y: number }[]
  height: number
  maxDepth: number
  yTop: number
  yBottom: number
}

// Thin wrapper that reads coverage depth ticks off the model and delegates
// rendering to the generic YScaleBar. Kept as a named export so downstream
// plugins that import `CoverageYScaleBar` keep working.
const CoverageYScaleBar = observer(function CoverageYScaleBar({
  model,
  orientation,
}: {
  model: { coverageTicks?: CoverageTicks }
  orientation?: 'left' | 'right'
}) {
  return (
    <YScaleBar ticks={model.coverageTicks} orientation={orientation ?? 'left'} />
  )
})

export default CoverageYScaleBar
