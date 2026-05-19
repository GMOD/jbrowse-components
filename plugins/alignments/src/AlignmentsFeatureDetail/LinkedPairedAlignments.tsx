import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { hasBreakpointSplitView } from '@jbrowse/sv-core'

import LaunchPairedEndBreakpointSplitViewPanel from './LaunchPairedEndBreakpointSplitViewPanel.tsx'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

export default function SuppAlignments({
  model,
  feature,
}: {
  model: AlignmentFeatureWidgetModel
  feature: AlignmentFeatureSerialized
}) {
  return hasBreakpointSplitView(model) ? (
    <BaseCard title="Paired alignments">
      <LaunchPairedEndBreakpointSplitViewPanel
        model={model}
        feature={feature}
      />
    </BaseCard>
  ) : null
}
