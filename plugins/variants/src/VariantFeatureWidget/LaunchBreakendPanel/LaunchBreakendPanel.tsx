import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { ActionLink } from '@jbrowse/core/ui'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import {
  getAssemblyName,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
  navToLoc,
} from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { SPLIT_VIEW_LINK_LABEL } from './labels.ts'

import type { VariantFeatureWidgetModel } from '../stateModelFactory.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

const LocStringList = observer(function LocStringList({
  locStrings,
  model,
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
}) {
  return locStrings.length ? (
    <div>
      <Typography>Navigate to breakend endpoint in linear view:</Typography>
      <ul>
        {locStrings.map(locString => (
          <li key={locString}>
            {locString}{' '}
            <ActionLink
              onClick={() => {
                navToLoc(locString, model)
              }}
            >
              Open in linear view
            </ActionLink>
          </li>
        ))}
      </ul>
    </div>
  ) : null
})

// One link, not one per endpoint: the split view is launched from the feature,
// and launchBreakpointSplitView resolves the mate from it, so a multi-mate
// record used to render N links that all did the same thing. The endpoints
// themselves are enumerated by LocStringList above.
const LaunchBreakpointSplitViewPanel = observer(
  function LaunchBreakpointSplitViewPanel({
    model,
    feature,
  }: {
    model: VariantFeatureWidgetModel
    feature: SimpleFeatureSerialized
  }) {
    const assemblyName = getAssemblyName(model.view)
    return assemblyName ? (
      <ActionLink
        onClick={() => {
          launchBreakpointSplitView({
            session: getSession(model),
            view: model.view,
            assemblyName,
            feature: new SimpleFeature(feature),
            stableViewId: `${model.id}_${assemblyName}_breakpointsplitview`,
          })
        }}
      >
        {SPLIT_VIEW_LINK_LABEL}
      </ActionLink>
    ) : null
  },
)

export default function LaunchBreakendPanel({
  model,
  locStrings,
  feature,
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  return (
    <BaseCard title="Breakends">
      <LocStringList model={model} locStrings={locStrings} />
      {hasBreakpointSplitView(model) ? (
        <LaunchBreakpointSplitViewPanel model={model} feature={feature} />
      ) : null}
    </BaseCard>
  )
}
