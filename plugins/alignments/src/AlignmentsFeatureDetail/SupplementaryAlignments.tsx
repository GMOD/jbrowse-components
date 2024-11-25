import React from 'react'
import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { getEnv, getSession } from '@jbrowse/core/util'
import LaunchBreakpointSplitViewPanel from './LaunchSupplementaryAlignmentBreakpointSplitViewPanel'
import SupplementaryAlignmentsLocStrings from './SupplementaryAlignmentsLocStrings'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory'
import type { ViewType } from '@jbrowse/core/pluggableElementTypes'

// locals
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export default function SupplementaryAlignments(props: {
  tag: string
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { model, tag, feature } = props
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
      <SupplementaryAlignmentsLocStrings model={model} tag={tag} />
      {viewType ? (
        <LaunchBreakpointSplitViewPanel
          viewType={viewType}
          model={model}
          feature={feature}
        />
      ) : null}
    </BaseCard>
  )
}
