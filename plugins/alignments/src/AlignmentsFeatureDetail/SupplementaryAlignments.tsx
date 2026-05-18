import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

import LaunchBreakpointSplitViewPanel from './LaunchSupplementaryAlignmentBreakpointSplitViewPanel.tsx'
import SupplementaryAlignmentsLocStrings from './SupplementaryAlignmentsLocStrings.tsx'
import { hasBreakpointSplitView } from './util.ts'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

export default function SupplementaryAlignments({
  model,
  tag,
  feature,
}: {
  tag: string
  model: AlignmentFeatureWidgetModel
  feature: AlignmentFeatureSerialized
}) {
  return (
    <BaseCard title="Supplementary alignments">
      <SupplementaryAlignmentsLocStrings model={model} tag={tag} />
      {hasBreakpointSplitView(model) ? (
        <LaunchBreakpointSplitViewPanel model={model} feature={feature} />
      ) : null}
    </BaseCard>
  )
}
