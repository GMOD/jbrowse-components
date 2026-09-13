import { Crosshairs } from '@jbrowse/core/ui'
import { ScorePlotChrome } from '@jbrowse/wiggle-core'
import { observer } from 'mobx-react'

import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { findSourceHit, hitTestMouse } from '../../shared/wiggleHitTest.ts'
import { WIGGLE_MARKS } from '../../shared/wiggleMarks.ts'

import type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'

const WiggleComponent = observer(function WiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  return (
    <ScorePlotChrome
      model={model}
      marks={WIGGLE_MARKS}
      testid="wiggle-display"
      plotGeometry={model.plotGeometry}
      findHit={offsetX => {
        const hit = hitTestMouse(
          model.host.visibleRegions,
          model.rpcDataMap,
          offsetX,
        )
        const source = hit?.data.sources[0]
        return source
          ? findSourceHit(
              source,
              hit.bp,
              hit.region.refName,
              model.effectiveSummaryScoreMode,
            )
          : undefined
      }}
      tooltip={mouseState => (
        <>
          {model.hoveredFeature && mouseState ? (
            <Crosshairs
              mouseX={mouseState.x}
              width={model.canvasWidthPx}
              height={model.height}
            />
          ) : null}
          <WiggleTooltip model={model} mouseState={mouseState} />
        </>
      )}
    />
  )
})

export default WiggleComponent

export type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'
