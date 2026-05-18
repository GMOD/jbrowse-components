import { lazy } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { SimpleFeature, getEnv, getSession } from '@jbrowse/core/util'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Link, Typography } from '@mui/material'

import type { VariantFeatureWidgetModel } from '../stateModelFactory.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

const BreakpointSplitViewChoiceDialog = lazy(
  () => import('./BreakpointSplitViewChoiceDialog.tsx'),
)

function LocStringList({
  locStrings,
  model,
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
}) {
  const session = getSession(model)
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
                const { view } = model
                try {
                  if (view) {
                    view.navToLocString?.(locString)
                  } else {
                    throw new Error(
                      'No view associated with this feature detail panel anymore',
                    )
                  }
                } catch (e) {
                  console.error(e)
                  session.notify(`${e}`)
                }
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
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                session.queueDialog(handleClose => [
                  BreakpointSplitViewChoiceDialog,
                  {
                    handleClose,
                    session,
                    feature: simpleFeature,
                    stableViewId: `${model.id}_${assemblyName}_breakpointsplitview`,
                    view: model.view,
                    assemblyName,
                  },
                ])
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

function hasViewType(pluginManager: PluginManager, name: string) {
  try {
    return !!pluginManager.getViewType(name)
  } catch {
    return false
  }
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
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  return (
    <BaseCard title="Breakends">
      <LocStringList model={model} locStrings={locStrings} />
      {hasViewType(pluginManager, 'BreakpointSplitView') ? (
        <LaunchBreakpointSplitViewPanel
          model={model}
          locStrings={locStrings}
          feature={feature}
        />
      ) : null}
    </BaseCard>
  )
}
