import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'

import LaunchPairedEndBreakpointSplitViewPanel from './LaunchPairedEndBreakpointSplitViewPanel.tsx'
import { hasBreakpointSplitView } from './util.ts'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export default function SuppAlignments({
  model,
  feature,
}: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
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
