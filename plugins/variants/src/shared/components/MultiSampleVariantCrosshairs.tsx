import { getContainingView } from '@jbrowse/core/util'
import { Crosshairs } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import MultiSampleVariantTooltip from './MultiSampleVariantTooltip.tsx'

import type { MouseState } from './types.ts'
import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const MultiSampleVariantCrosshairs = observer(
  function MultiSampleVariantCrosshairs({
    mouseState,
    model,
  }: {
    mouseState: MouseState
    model: MultiSampleVariantBaseModel
  }) {
    const { hoveredTooltipSource, height } = model
    const { width } = getContainingView(model) as LinearGenomeViewModel
    const { x, y, clientX, clientY } = mouseState

    return (
      <>
        <Crosshairs mouseX={x} mouseY={y} width={width} height={height} zIndex={800} />
        {hoveredTooltipSource ? (
          <MultiSampleVariantTooltip
            source={hoveredTooltipSource}
            x={clientX}
            y={clientY}
          />
        ) : null}
      </>
    )
  },
)

export default MultiSampleVariantCrosshairs
