import SkippedFeaturesIndicator from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import { DisplayCrosshairs } from '@jbrowse/tree-sidebar'
import { ScorePlotChrome } from '@jbrowse/wiggle-core/ScorePlotChrome'
import { observer } from 'mobx-react'

import { findMarkHit } from '../findMarkHit.ts'
import MarkFacetChips from './MarkFacetChips.tsx'
import MarkRows from './MarkRows.tsx'
import MarkTextLayer from './MarkTextLayer.tsx'
import MarkTooltip from './MarkTooltip.tsx'

import type { MarkTooltipModel } from './MarkTooltip.tsx'
import type { MarkDisplayModel } from './markDisplayTypes.ts'

const LinearMarkDisplayComponent = observer(
  function LinearMarkDisplayComponent({
    model,
  }: {
    model: MarkDisplayModel & MarkTooltipModel
  }) {
    return (
      <ScorePlotChrome
        model={model}
        marks={model.markList}
        testid="mark-display"
        plotGeometry={model.plotBox}
        findHit={(x, y) =>
          findMarkHit(
            x,
            y,
            model.renderBlocks,
            model.rpcDataMap,
            model.markList,
            model.renderState,
            model.host.displayedRegions,
          )
        }
        overlay={() => (
          <>
            <MarkTextLayer model={model} />
            <MarkFacetChips model={model} />
            <MarkRows model={model} />
          </>
        )}
        // The vertical guide for the pointer, and the row guide beside it
        // under `rows`; over a value axis a horizontal one reads as a rule.
        tooltip={mouseState => (
          <>
            {mouseState ? (
              <DisplayCrosshairs
                model={model}
                mouseX={mouseState.x}
                mouseY={model.drawsRows ? mouseState.y : undefined}
              />
            ) : null}
            <MarkTooltip model={model} mouseState={mouseState} />
          </>
        )}
        indicators={() => (
          <SkippedFeaturesIndicator {...model.skippedFeatures} />
        )}
      />
    )
  },
)

export default LinearMarkDisplayComponent
