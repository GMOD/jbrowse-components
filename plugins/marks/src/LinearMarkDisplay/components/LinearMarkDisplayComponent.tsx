import { pluralize } from '@jbrowse/core/util'
import SkippedFeaturesIndicator from '@jbrowse/display-kit/SkippedFeaturesIndicator'
import TrackControl from '@jbrowse/display-kit/TrackControl'
import { ScorePlotChrome } from '@jbrowse/wiggle-core/ScorePlotChrome'
import { observer } from 'mobx-react'

import { findMarkHit } from '../findMarkHit.ts'
import MarkFacetChips from './MarkFacetChips.tsx'
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
        contextMenu={model}
        overlay={({ plotHeight }) => (
          <MarkFacetChips model={model} plotHeight={plotHeight} />
        )}
        tooltip={mouseState => (
          <MarkTooltip model={model} mouseState={mouseState} />
        )}
        indicators={() => (
          <>
            {model.densityStandInNotice ? (
              <TrackControl
                icon="filter"
                label="density"
                tooltip={model.densityStandInNotice}
              />
            ) : null}
            {model.notices.length > 0 ? (
              <TrackControl
                icon="filter"
                warning
                label={`${model.notices.length} config ${pluralize(model.notices.length, 'problem')}`}
                tooltip={model.notices.join('; ')}
              />
            ) : null}
            <SkippedFeaturesIndicator {...model.skippedFeatures} />
          </>
        )}
      />
    )
  },
)

export default LinearMarkDisplayComponent
