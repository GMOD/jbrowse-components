import SkippedFeaturesIndicator from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import { DisplayCrosshairs } from '@jbrowse/display-ui'
import { ScorePlotChrome } from '@jbrowse/wiggle-core/ScorePlotChrome'
import { observer } from 'mobx-react'

import { findMarkHit } from '../findMarkHit.ts'
import MarkFacetChips from './MarkFacetChips.tsx'
import MarkRowsLayer from './MarkRowsLayer.tsx'
import MarkTextLayer from './MarkTextLayer.tsx'
import MarkTooltip from './MarkTooltip.tsx'

import type { MarkTooltipModel } from './MarkTooltip.tsx'
import type { MarkDisplayModel } from './markDisplayTypes.ts'
import type { ReactNode } from 'react'

/**
 * The mark display's plot, with the text, section chip and row layers over
 * it; `children` joins them, as a subtype's own overlay.
 */
const LinearMarkDisplayComponent = observer(
  function LinearMarkDisplayComponent({
    model,
    children,
  }: {
    model: MarkDisplayModel & MarkTooltipModel
    children?: ReactNode
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
            <MarkRowsLayer model={model} />
            {children}
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
