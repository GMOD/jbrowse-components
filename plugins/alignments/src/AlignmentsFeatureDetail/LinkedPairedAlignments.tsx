import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getAssemblyName, hasBreakpointSplitView } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { formatStartLocation } from '../shared/locStrings.ts'
import {
  buildPairedEndMateFeature,
  computeMateFields,
} from '../shared/mateFeature.ts'
import BreakpointPair from './BreakpointPair.tsx'
import { LaunchBreakpointSplitViewLink } from './links.tsx'

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
        {/* the read's own leftmost base, then PNEXT — the mate's leftmost base,
            the only mate coordinate the record carries */}
        <BreakpointPair
          from={formatStartLocation(refName, start)}
          to={formatStartLocation(mate.nextRef, mate.nextPos)}
        />{' '}
        (breakpoint split view)
      </LaunchBreakpointSplitViewLink>
    </BaseCard>
  ) : null
})

export default LinkedPairedAlignments
