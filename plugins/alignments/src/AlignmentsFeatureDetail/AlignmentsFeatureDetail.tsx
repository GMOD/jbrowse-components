import React, { lazy } from 'react'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { Paper } from '@mui/material'
import clone from 'clone'
import { observer } from 'mobx-react'

// locals
import Flags from './Flags'
import Formatter from './Formatter'
import PairLink from './PairLink'
import { tags } from './tagInfo'
import { getTag } from './util'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory'

// local components

// lazies
const SupplementaryAlignments = lazy(() => import('./SupplementaryAlignments'))
const LinkedPairedAlignments = lazy(() => import('./LinkedPairedAlignments'))

const AlignmentsFeatureDetails = observer(function (props: {
  model: AlignmentFeatureWidgetModel
}) {
  const { model } = props
  const { featureData } = model
  const feat = clone(featureData)
  const SA = getTag('SA', feat) as string | undefined
  const { flags } = feat
  return (
    <Paper data-testid="alignment-side-drawer">
      <FeatureDetails
        {...props}
        // @ts-expect-error
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
      {flags & 1 ? (
        <LinkedPairedAlignments model={model} feature={feat} />
      ) : null}

      {flags !== undefined ? <Flags feature={feat} {...props} /> : null}
    </Paper>
  )
})

export default AlignmentsFeatureDetails
