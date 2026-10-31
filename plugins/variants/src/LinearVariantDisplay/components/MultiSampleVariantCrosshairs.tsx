import { DisplayCrosshairs } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import MultiSampleVariantTooltip from './MultiSampleVariantTooltip.tsx'

import type { LinearVariantDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui'

// The two things that follow the pointer: the row/column crosshairs and the
// tooltip for whatever is hovered. The crosshairs measure against the rows, so
// over the records band they are off, where the tooltip names the record.
const MultiSampleVariantCrosshairs = observer(
  function MultiSampleVariantCrosshairs({
    mouseState,
    model,
    crosshairs = true,
  }: {
    mouseState: MouseState
    model: LinearVariantDisplayModel
    crosshairs?: boolean
  }) {
    const { hoveredTooltipSource } = model
    const { x, y, clientX, clientY } = mouseState

    return (
      <>
        {crosshairs ? (
          <DisplayCrosshairs model={model} mouseX={x} mouseY={y} />
        ) : null}
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
