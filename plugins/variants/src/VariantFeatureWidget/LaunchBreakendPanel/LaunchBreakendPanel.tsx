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
              (LGV)
            </ActionLink>
          </li>
        ))}
      </ul>
    </div>
  ) : null
})

const LaunchBreakpointSplitViewPanel = observer(
  function LaunchBreakpointSplitViewPanel({
    locStrings,
    model,
    feature,
  }: {
    locStrings: string[]
    model: VariantFeatureWidgetModel
    feature: SimpleFeatureSerialized
  }) {
    const session = getSession(model)
    const simpleFeature = new SimpleFeature(feature)
    const assemblyName = getAssemblyName(model.view)
    return assemblyName ? (
      <div>
        <Typography>Launch split view</Typography>
        <ul>
          {locStrings.map(locString => (
            <li key={locString}>
              {`${feature.refName}:${feature.start} // ${locString}`}{' '}
              <ActionLink
                onClick={() => {
                  launchBreakpointSplitView({
                    session,
                    view: model.view,
                    assemblyName,
                    feature: simpleFeature,
                    stableViewId: `${model.id}_${assemblyName}_breakpointsplitview`,
                  })
                }}
              >
                (breakpoint split view)
              </ActionLink>
            </li>
          ))}
        </ul>
      </div>
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
        <LaunchBreakpointSplitViewPanel
          model={model}
          locStrings={locStrings}
          feature={feature}
        />
      ) : null}
    </BaseCard>
  )
}
