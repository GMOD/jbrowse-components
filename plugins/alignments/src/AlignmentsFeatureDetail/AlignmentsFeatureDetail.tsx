import { lazy } from 'react'

import { SAM_FLAG_PAIRED } from '@jbrowse/alignments-core'
import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import Formatter from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/Formatter'
import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import Flags from './Flags.tsx'
import { NavToLocLink } from './links.tsx'
import { fieldDescriptions, tags } from './tagInfo.ts'
import { getStringTag } from './util.ts'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

// lazies
const SupplementaryAlignments = lazy(
  () => import('./SupplementaryAlignments.tsx'),
)
const LinkedPairedAlignments = lazy(
  () => import('./LinkedPairedAlignments.tsx'),
)

const AlignmentsFeatureDetailsBody = observer(
  function AlignmentsFeatureDetailsBody({
    feat,
    model,
  }: {
    feat: AlignmentFeatureSerialized
    model: AlignmentFeatureWidgetModel
  }) {
    const { flags } = feat
    const SA = getStringTag('SA', feat)
    return (
      <Paper data-testid="alignment-side-drawer">
        <FeatureDetails
          model={model}
          descriptions={{ ...fieldDescriptions, tags }}
          feature={feat}
          omit={['flags', 'next_ref', 'next_pos']}
          formatter={(value, key) =>
            key === 'next_segment_position' ? (
              <NavToLocLink model={model} loc={value as string}>
                {value as string}
              </NavToLocLink>
            ) : (
              <Formatter value={value} />
            )
          }
        />

        {SA !== undefined ? (
          <SupplementaryAlignments model={model} tag={SA} feature={feat} />
        ) : null}
        {flags !== undefined ? (
          <>
            {flags & SAM_FLAG_PAIRED ? (
              <LinkedPairedAlignments model={model} feature={feat} />
            ) : null}

            <Flags flags={flags} />
          </>
        ) : null}
      </Paper>
    )
  },
)

const AlignmentsFeatureDetails = observer(function AlignmentsFeatureDetails({
  model,
}: {
  model: AlignmentFeatureWidgetModel
}) {
  const { featureData } = model
  return featureData ? (
    <AlignmentsFeatureDetailsBody feat={featureData} model={model} />
  ) : (
    <Paper sx={{ p: 2 }}>
      <Typography>
        No feature loaded. It may not be available after a page refresh because
        it was too large to persist in localStorage.
      </Typography>
    </Paper>
  )
})

export default AlignmentsFeatureDetails
