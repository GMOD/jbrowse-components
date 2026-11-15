import { lazy } from 'react'

import { SAM_FLAG_PAIRED } from '@jbrowse/cigar-utils'
import {
  FeatureDetailsFrame,
  FeatureDetailsPanel,
} from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
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

const descriptions = { ...fieldDescriptions, tags }

const omit = ['flags', 'next_ref', 'next_pos']

const AlignmentPanels = observer(function AlignmentPanels({
  feat,
  model,
}: {
  feat: AlignmentFeatureSerialized
  model: AlignmentFeatureWidgetModel
}) {
  const { flags } = feat
  const SA = getStringTag('SA', feat)
  return (
    <>
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
    </>
  )
})

const AlignmentsFeatureDetails = observer(function AlignmentsFeatureDetails({
  model,
}: {
  model: AlignmentFeatureWidgetModel
}) {
  return (
    <FeatureDetailsFrame
      model={model}
      renderBody={(feature, raw) => (
        <FeatureDetailsPanel
          model={model}
          feature={feature}
          unformatted={raw}
          descriptions={descriptions}
          omit={omit}
          formatter={(value, key) =>
            key === 'next_segment_position' ? (
              <NavToLocLink model={model} loc={String(value)}>
                {String(value)}
              </NavToLocLink>
            ) : (
              value
            )
          }
        >
          <AlignmentPanels feat={raw} model={model} />
        </FeatureDetailsPanel>
      )}
    />
  )
})

export default AlignmentsFeatureDetails
