import { DisplayCrosshairs } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import MultiSampleVariantTooltip from './MultiSampleVariantTooltip.tsx'

import type { LinearMultiSampleVariantDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui'

// The two things that follow the pointer over the rows: the row/column
// crosshairs and the tooltip for whatever is hovered.
const MultiSampleVariantCrosshairs = observer(
  function MultiSampleVariantCrosshairs({
    mouseState,
    model,
  }: {
    mouseState: MouseState
    model: LinearMultiSampleVariantDisplayModel
  }) {
    const { hoveredTooltipSource } = model
    const { x, y, clientX, clientY } = mouseState

    return (
      <>
        <DisplayCrosshairs model={model} mouseX={x} mouseY={y} />
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
