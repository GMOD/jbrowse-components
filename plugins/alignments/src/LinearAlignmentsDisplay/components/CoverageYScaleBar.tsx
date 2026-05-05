import { YScaleBar } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

const CoverageYScaleBar = observer(function CoverageYScaleBar({
  model,
  orientation,
}: {
  model: { coverageTicks?: YScaleTicks }
  orientation?: 'left' | 'right'
}) {
  return (
    <YScaleBar
      ticks={model.coverageTicks}
      orientation={orientation ?? 'left'}
    />
  )
})

export default CoverageYScaleBar
