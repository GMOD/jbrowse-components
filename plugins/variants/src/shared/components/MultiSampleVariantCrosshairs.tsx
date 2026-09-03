import { DisplayCrosshairs } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import MultiSampleVariantTooltip from './MultiSampleVariantTooltip.tsx'

import type { MultiSampleVariantBaseModel } from '../MultiSampleVariantBaseModel.ts'
import type { MouseState } from '@jbrowse/core/ui'

// The two things that follow the pointer: the row/column crosshairs and the
// tooltip for whatever is hovered.
//
// `crosshairs` is separate from "is anything hovered" because the two answer to
// different bands. The rows are what the crosshairs measure against, so a
// display stacking a band above them (the regular one's variant lane) passes
// false while the pointer is up there — a crosshair drawn over the lane names a
// genotype row the pointer is not on. The tooltip has no such restriction: it
// describes whatever set `hoveredFeature`, which in that band is the record the
// lane mark stands for.
const MultiSampleVariantCrosshairs = observer(
  function MultiSampleVariantCrosshairs({
    mouseState,
    model,
    crosshairs = true,
  }: {
    mouseState: MouseState
    model: MultiSampleVariantBaseModel
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
