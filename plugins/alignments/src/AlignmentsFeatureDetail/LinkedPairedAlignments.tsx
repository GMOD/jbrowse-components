import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getEnv, getSession } from '@jbrowse/core/util'

import LaunchPairedEndBreakpointSplitViewPanel from './LaunchPairedEndBreakpointSplitViewPanel'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory'
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
  return (
    <BaseCard {...props} title="Paired alignments">
      {hasBreakendSplitView ? (
        <LaunchPairedEndBreakpointSplitViewPanel
          model={model}
          feature={feature}
        />
      ) : null}
    </BaseCard>
  )
}
