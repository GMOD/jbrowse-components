import { lazy } from 'react'

import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Flags from './Flags'
import Formatter from './Formatter'
import PairLink from './PairLink'
import { tags } from './tagInfo'
import { getTag } from './util'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// lazies
const SupplementaryAlignments = lazy(() => import('./SupplementaryAlignments'))
const LinkedPairedAlignments = lazy(() => import('./LinkedPairedAlignments'))

function SA({
  model,
  feat,
}: {
  model: AlignmentFeatureWidgetModel
  feat: any
}) {
  const SA = feat ? (getTag('SA', feat) as string | undefined) : undefined
  return SA !== undefined ? (
    <SupplementaryAlignments model={model} tag={SA} feature={feat} />
  ) : null
}

function FeatDefined(props: {
  feat: SimpleFeatureSerialized
  model: AlignmentFeatureWidgetModel
}) {
  const { model, feat } = props
  const flags = feat.flags as number | null
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

      <SA model={model} feat={feat} />
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
}

const AlignmentsFeatureDetails = observer(function (props: {
  model: AlignmentFeatureWidgetModel
}) {
  const { model } = props
  const { featureData } = model
  const feat = structuredClone(featureData)
  return feat ? (
    <FeatDefined feat={feat} model={model} />
  ) : (
    <div>
      No feature, may have been skipped from serialization because it was too
      large
    </div>
  )
})

export default AlignmentsFeatureDetails
