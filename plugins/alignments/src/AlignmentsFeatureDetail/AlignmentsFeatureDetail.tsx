import { lazy } from 'react'

import FeatureDetails from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/FeatureDetails'
import { ActionLink } from '@jbrowse/core/ui'
import { navToLoc } from '@jbrowse/sv-core'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import Flags from './Flags.tsx'
import Formatter from './Formatter.tsx'
import { tags } from './tagInfo.ts'
import { getTag } from './util.ts'

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
              <ActionLink
                onClick={() => {
                  navToLoc(value as string, model)
                }}
              >
                {value as string}
              </ActionLink>
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
            {flags & 1 ? (
              <LinkedPairedAlignments model={model} feature={feat} />
            ) : null}

            <Flags flags={flags} />
          </>
        ) : null}
      </Paper>
    )
  },
)

const AlignmentsFeatureDetails = observer(
  function AlignmentsFeatureDetails(props: {
    model: AlignmentFeatureWidgetModel
  }) {
    const { model } = props
    const { featureData } = model
    const feat = structuredClone(featureData)
    return feat ? (
      <AlignmentsFeatureDetailsBody feat={feat} {...props} />
    ) : (
      <div>
        No feature loaded, may not be available after page refresh because it
        was too large for localStorage
      </div>
    )
  },
)

export default AlignmentsFeatureDetails
