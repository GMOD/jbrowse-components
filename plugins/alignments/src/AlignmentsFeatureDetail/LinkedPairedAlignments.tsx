import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { toLocale } from '@jbrowse/core/util'
import { getAssemblyName, hasBreakpointSplitView } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { LaunchBreakpointSplitViewLink } from './links.tsx'
import {
  buildPairedEndMateFeature,
  computeMateFields,
} from '../shared/mateFeature.ts'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

const LinkedPairedAlignments = observer(function LinkedPairedAlignments({
  model,
  feature,
}: {
  model: AlignmentFeatureWidgetModel
  feature: AlignmentFeatureSerialized
}) {
  const { uniqueId, refName, start, end, strand, flags, next_ref, next_pos } =
    feature
  const assemblyName = getAssemblyName(model.view)
  const mate = computeMateFields({
    uniqueId,
    refName,
    start,
    end,
    strand,
    flags,
    nextRef: next_ref,
    nextPos: next_pos,
  })
  return hasBreakpointSplitView(model) && assemblyName && mate ? (
    <BaseCard title="Paired alignments">
      <Typography>Launch split view</Typography>
      <LaunchBreakpointSplitViewLink
        model={model}
        assemblyName={assemblyName}
        feature={buildPairedEndMateFeature(mate)}
      >
        {refName}:{toLocale(start)} -&gt; {mate.nextRef}:{toLocale(mate.nextPos)}{' '}
        (breakpoint split view)
      </LaunchBreakpointSplitViewLink>
    </BaseCard>
  ) : null
})

export default LinkedPairedAlignments
