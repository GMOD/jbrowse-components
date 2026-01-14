import { lazy } from 'react'

import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Flags from './Flags.tsx'
import Formatter from './Formatter.tsx'
import PairLink from './PairLink.tsx'
import { tags } from './tagInfo.ts'
import { getTag } from './util.ts'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// lazies
const SupplementaryAlignments = lazy(
  () => import('./SupplementaryAlignments.tsx'),
)
const LinkedPairedAlignments = lazy(
  () => import('./LinkedPairedAlignments.tsx'),
)

const FeatDefined = observer(function FeatDefined(props: {
  feat: SimpleFeatureSerialized
  model: AlignmentFeatureWidgetModel
}) {
  const { model, feat } = props
  const flags = feat.flags as number | null
  const SA = getTag('SA', feat) as string | undefined
  return (
    <Paper data-testid="alignment-side-drawer">
      <FeatureDetails
        {...props}
        descriptions={{ tags }}
        feature={feat}
        formatter={(value, key) =>
          key === 'next_segment_position' ? (
            <PairLink model={model} locString={value as string} />
          ) : (
            <Formatter value={value} />
          )
        }
      />

      {SA !== undefined ? (
        <SupplementaryAlignments model={model} tag={SA} feature={feat} />
      ) : null}
      {flags != null ? (
        <>
          {flags & 1 ? (
            <LinkedPairedAlignments model={model} feature={feat} />
          ) : null}

          <Flags flags={flags} {...props} />
        </>
      ) : null}
    </Paper>
  )
})

const AlignmentsFeatureDetails = observer(
  function AlignmentsFeatureDetails(props: {
    model: AlignmentFeatureWidgetModel
  }) {
    const { model } = props
    const { featureData } = model
    const feat = structuredClone(featureData)
    return feat ? (
      <FeatDefined feat={feat} {...props} />
    ) : (
      <div>
        No feature loaded, may not be available after page refresh because it
        was too large for localStorage
      </div>
    )
  },
)

export default AlignmentsFeatureDetails
