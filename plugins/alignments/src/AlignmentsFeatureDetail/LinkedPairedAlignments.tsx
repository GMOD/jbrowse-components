import React from 'react'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getEnv, getSession } from '@jbrowse/core/util'

// locals
import LaunchPairedEndBreakpointSplitViewPanel from './LaunchPairedEndBreakpointSplitViewPanel'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory'
import type { ViewType } from '@jbrowse/core/pluggableElementTypes'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export default function SuppAlignments(props: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { model, feature } = props
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  let viewType: ViewType | undefined

  try {
    viewType = pluginManager.getViewType('BreakpointSplitView')
  } catch (e) {
    // ignore
  }

  return (
    <BaseCard {...props} title="Supplementary alignments">
      {viewType ? (
        <LaunchPairedEndBreakpointSplitViewPanel
          viewType={viewType}
          model={model}
          feature={feature}
        />
      ) : null}
    </BaseCard>
  )
}
