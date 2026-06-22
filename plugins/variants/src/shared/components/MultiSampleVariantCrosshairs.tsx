import { Crosshairs } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
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
    const { hoveredTooltipSource, height, showTree, hierarchy, treeAreaWidth } =
      model
    const { width } = getContainingView(model) as LinearGenomeViewModel
    const { x, y, clientX, clientY } = mouseState
    const sidebarOffset = showTree && hierarchy ? treeAreaWidth : 0

    return (
      <>
        <Crosshairs
          mouseX={x}
          mouseY={y}
          width={width}
          height={height}
          zIndex={800}
          minLeft={sidebarOffset}
        />
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
