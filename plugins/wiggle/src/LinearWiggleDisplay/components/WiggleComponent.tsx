import ConfigProblemsIndicator from '@jbrowse/display-kit/ConfigProblemsIndicator'
import {
  DisplayCrosshairs,
  TreeSidebar,
  treeSidebarOffset,
} from '@jbrowse/tree-sidebar'
import { ScorePlotChrome } from '@jbrowse/wiggle-core/ScorePlotChrome'
import { observer } from 'mobx-react'

import WiggleTooltip from '../../shared/WiggleTooltip.tsx'
import { WIGGLE_MARKS } from '../../shared/wiggleMarks.ts'
import WiggleRowLabels from '../WiggleRowLabels.tsx'
import WiggleRowSeparators from '../WiggleRowSeparators.tsx'
import WiggleHint from './WiggleHint.tsx'
import WiggleScoreFlag from './WiggleScoreFlag.tsx'
import { findWiggleContextHit, findWiggleHit } from './findHit.ts'

import type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'

export type { WiggleDisplayModel } from './wiggleDisplayTypes.ts'

const WiggleOverlay = observer(function WiggleOverlay({
  model,
}: {
  model: WiggleDisplayModel
}) {
  const { height, canvasWidthPx: width } = model
  return (
    <>
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          height,
          width,
        }}
      >
        <g transform={`translate(0,${model.rowsTopOffset})`}>
          <WiggleRowLabels
            model={model}
            labelOffset={treeSidebarOffset(model)}
          />
          <WiggleRowSeparators model={model} width={width} />
        </g>
      </svg>
      <TreeSidebar model={model} />
      {/* inline hint when the plot would otherwise be a silent blank */}
      <WiggleHint model={model} />
    </>
  )
})

const WiggleComponent = observer(function WiggleComponent({
  model,
}: {
  model: WiggleDisplayModel
}) {
  // `findWiggleHit` takes y from the display's top, the chrome hands it from
  // the plot's
  const hitAt = (x: number, y: number) =>
    findWiggleHit(
      model,
      model.host.visibleRegions,
      x,
      y + model.plotGeometry.yTop,
    )
  return (
    <ScorePlotChrome
      model={model}
      marks={WIGGLE_MARKS}
      testid="wiggle-display"
      plotGeometry={model.plotGeometry}
      findHit={hitAt}
      // The column the sort ranks at and the record under the pointer are two
      // answers to one click: the sort needs every row's score at `bp`, the
      // feature items the one row `y` picked. A column exists where no bin
      // does, so the menu cannot be built from the hover hit.
      findContextHit={(x, y) => {
        const column = findWiggleContextHit(model, model.host.visibleRegions, x)
        return column ? { ...column, feature: hitAt(x, y) } : undefined
      }}
      contextMenu={model}
      overlay={() => <WiggleOverlay model={model} />}
      // The vertical guide is drawn for the pointer and not for a hit. A
      // horizontal one reads as an axis rule, so the score rides a flag on the
      // guide's top instead.
      tooltip={mouseState => (
        <>
          {mouseState ? (
            <>
              <DisplayCrosshairs model={model} mouseX={mouseState.x} />
              <WiggleScoreFlag
                hit={model.hoveredFeature}
                mouseX={mouseState.x}
                width={model.canvasWidthPx}
              />
            </>
          ) : null}
          <WiggleTooltip model={model} mouseState={mouseState} />
        </>
      )}
      indicators={() => <ConfigProblemsIndicator notices={model.notices} />}
    />
  )
})

export default WiggleComponent
