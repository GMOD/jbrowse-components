import { DisplayCrosshairs } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import MultiSampleVariantTooltip from './MultiSampleVariantTooltip.tsx'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'
import type { MouseState } from '@jbrowse/core/ui'

const MultiSampleVariantCrosshairs = observer(
  function MultiSampleVariantCrosshairs({
    mouseState,
    model,
  }: {
    mouseState: MouseState
    model: MultiSampleVariantBaseModel
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
