import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { hasBreakpointSplitView } from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import LaunchPairedEndBreakpointSplitViewPanel from './LaunchPairedEndBreakpointSplitViewPanel.tsx'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

const LinkedPairedAlignments = observer(function LinkedPairedAlignments({
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
})

export default LinkedPairedAlignments
