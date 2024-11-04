import React, { lazy } from 'react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import clone from 'clone'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'

// locals
import { getTag } from './util'
import { tags } from './tagInfo'
import { AlignmentFeatureWidgetModel } from './stateModelFactory'

// local components
import Flags from './Flags'
import PairLink from './PairLink'
import Formatter from './Formatter'

// lazies
const SupplementaryAlignments = lazy(() => import('./SupplementaryAlignments'))
const LinkedPairedAlignments = lazy(() => import('./LinkedPairedAlignments'))

const omit = ['clipPos', 'flags']

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
        omit={omit}
        // @ts-expect-error
        descriptions={{ ...tags, tags: tags }}
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
