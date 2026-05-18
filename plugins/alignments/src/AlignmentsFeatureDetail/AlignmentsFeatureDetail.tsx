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

const FeatDefined = observer(function FeatDefined({
  feat,
  model,
}: {
  feat: SimpleFeatureSerialized
  model: AlignmentFeatureWidgetModel
}) {
  const flags = typeof feat.flags === 'number' ? feat.flags : null
  const sa = getTag('SA', feat)
  const SA = typeof sa === 'string' ? sa : undefined
  return (
    <Paper data-testid="alignment-side-drawer">
      <FeatureDetails
        model={model}
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
      {flags !== null ? (
        <>
          {flags & 1 ? (
            <LinkedPairedAlignments model={model} feature={feat} />
          ) : null}

          <Flags flags={flags} />
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
