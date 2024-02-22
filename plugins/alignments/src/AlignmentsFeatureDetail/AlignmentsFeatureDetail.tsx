import React from 'react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'
import clone from 'clone'
import { FeatureDetails } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'

// locals
import { getTag } from './util'
import { tags } from './tagInfo'
import { AlignmentFeatureWidgetModel } from './stateModelFactory'

// local components
import SuppAlignments from './SuppAlignments'
import Flags from './Flags'
import PairLink from './PairLink'
import Formatter from './Formatter'

const omit = ['clipPos', 'flags']

const AlignmentsFeatureDetails = observer(function (props: {
  model: AlignmentFeatureWidgetModel
}) {
  const { model } = props
  const feat = clone(model.featureData)
  const SA = getTag('SA', feat) as string
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
      {SA ? <SuppAlignments model={model} tag={SA} feature={feat} /> : null}
      {feat.flags !== undefined ? <Flags feature={feat} {...props} /> : null}
    </Paper>
  )
})

export default AlignmentsFeatureDetails
