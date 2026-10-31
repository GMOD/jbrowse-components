import { DisplayCrosshairs } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import VariantTooltip from './VariantTooltip.tsx'

import type { LinearVariantDisplayModel } from '../model.ts'
import type { MouseState } from '@jbrowse/core/ui'

// The two things that follow the pointer: the row/column crosshairs and the
// tooltip for whatever is hovered. The crosshairs measure against the rows, so
// over the records band they are off, where the tooltip names the record.
const VariantCrosshairs = observer(function VariantCrosshairs({
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
        <VariantTooltip source={hoveredTooltipSource} x={clientX} y={clientY} />
      ) : null}
    </>
  )
})

export default VariantCrosshairs
