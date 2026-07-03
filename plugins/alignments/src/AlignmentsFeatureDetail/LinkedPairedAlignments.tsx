import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { hasBreakpointSplitView } from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import LaunchPairedEndBreakpointSplitViewPanel from './LaunchPairedEndBreakpointSplitViewPanel.tsx'
import { computeMateFields } from '../shared/mateFeature.ts'

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
  const hasMappedMate = !!computeMateFields({
    uniqueId,
    refName,
    start,
    end,
    strand,
    flags,
    nextRef: next_ref,
    nextPos: next_pos,
  })
  return hasBreakpointSplitView(model) && hasMappedMate ? (
    <BaseCard title="Paired alignments">
      <LaunchPairedEndBreakpointSplitViewPanel
        model={model}
        feature={feature}
      />
    </BaseCard>
  ) : null
})

export default LinkedPairedAlignments
