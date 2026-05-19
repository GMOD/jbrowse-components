import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { SimpleFeature, getSession } from '@jbrowse/core/util'
import {
  getAssemblyName,
  hasBreakpointSplitView,
  launchBreakpointSplitView,
  navToLoc,
} from '@jbrowse/sv-core'
import { Link, Typography } from '@mui/material'

import type { VariantFeatureWidgetModel } from '../stateModelFactory.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

function LocStringList({
  locStrings,
  model,
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
}) {
  return (
    <div>
      <Typography>Navigate to breakend endpoint in linear view:</Typography>
      <ul>
        {locStrings.map((locString, index) => (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <li key={`${locString}-${index}`}>
            {locString}{' '}
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                navToLoc(locString, model)
              }}
            >
              (LGV)
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LaunchBreakpointSplitViewPanel({
  locStrings,
  model,
  feature,
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const simpleFeature = new SimpleFeature(feature)
  const assemblyName = getAssemblyName(model.view)
  return assemblyName ? (
    <div>
      <Typography>Launch split view</Typography>
      <ul>
        {locStrings.map(locString => (
          <li key={locString}>
            {`${feature.refName}:${feature.start} // ${locString}`}{' '}
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                launchBreakpointSplitView({
                  session: getSession(model),
                  view: model.view,
                  assemblyName,
                  feature: simpleFeature,
                  stableViewId: `${model.id}_${assemblyName}_breakpointsplitview`,
                })
              }}
            >
              (breakpoint split view)
            </Link>
          </li>
        ))}
      </ul>
    </div>
  ) : null
}

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
