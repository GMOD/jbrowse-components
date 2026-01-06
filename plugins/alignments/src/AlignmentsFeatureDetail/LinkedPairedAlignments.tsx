import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getEnv, getSession } from '@jbrowse/core/util'

import LaunchPairedEndBreakpointSplitViewPanel from './LaunchPairedEndBreakpointSplitViewPanel.tsx'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export default function SuppAlignments(props: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { model, feature } = props
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  let hasBreakendSplitView = false

  try {
    hasBreakendSplitView = !!pluginManager.getViewType('BreakpointSplitView')
  } catch (e) {
    // ignore
  }
  return hasBreakendSplitView ? (
    <BaseCard {...props} title="Paired alignments">
      <LaunchPairedEndBreakpointSplitViewPanel
        model={model}
        feature={feature}
      />
    </BaseCard>
  ) : null
}
