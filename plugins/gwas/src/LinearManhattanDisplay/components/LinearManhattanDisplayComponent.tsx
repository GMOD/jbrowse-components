import ConfigProblemsIndicator from '@jbrowse/display-kit/ConfigProblemsIndicator'
import SkippedFeaturesIndicator from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import { ScorePlotChrome } from '@jbrowse/wiggle-core/ScorePlotChrome'
import { observer } from 'mobx-react'

import { findManhattanHit } from '../findManhattanHit.ts'
import { MANHATTAN_MARKS } from '../manhattanMarks.ts'
import LdIndexWarning from './LdIndexWarning.tsx'
import TooltipComponent from './TooltipComponent.tsx'

import type { ManhattanDisplayModel } from './manhattanDisplayTypes.ts'

const LinearManhattanDisplayComponent = observer(
  function LinearManhattanDisplayComponent({
    model,
  }: {
    model: ManhattanDisplayModel
  }) {
    return (
      <ScorePlotChrome
        model={model}
        marks={MANHATTAN_MARKS}
        testid="manhattan-display"
        findHit={(x, y) =>
          findManhattanHit(
            x,
            y,
            model.renderBlocks,
            model.rpcDataMap,
            model.renderState,
            model.host.displayedRegions,
          )
        }
        contextMenu={model}
        tooltip={mouseState => (
          <TooltipComponent model={model} mouseState={mouseState} />
        )}
        overlay={({ yTop }) =>
          model.indexSnpMissing ? <LdIndexWarning offsetTop={yTop} /> : null
        }
        indicators={() => (
          <>
            <ConfigProblemsIndicator notices={model.notices} />
            <SkippedFeaturesIndicator {...model.skippedFeatures} />
          </>
        )}
      />
    )
  },
)

export default LinearManhattanDisplayComponent
