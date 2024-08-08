import React, { lazy } from 'react'
import { Link, Typography } from '@mui/material'
import {
  getEnv,
  getSession,
  SimpleFeature,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'
import { BaseCard } from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'

import { VariantFeatureWidgetModel } from './stateModelFactory'

// lazies
const BreakendOptionDialog = lazy(() => import('./BreakendOptionDialog'))

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
      <Typography>Link to linear view of breakend endpoints</Typography>
      <ul>
        {locStrings.map((locString, index) => (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <li key={`${locString}-${index}`}>
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
              {`LGV - ${locString}`}
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
  viewType,
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
  feature: SimpleFeatureSerialized
  viewType: ViewType
}) {
  const session = getSession(model)
  const simpleFeature = new SimpleFeature(feature)
  return (
    <div>
      <Typography>
        Launch split views with breakend source and target
      </Typography>
      <ul>
        {locStrings.map(locString => (
          <li key={`${JSON.stringify(locString)}`}>
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                session.queueDialog(handleClose => [
                  BreakendOptionDialog,
                  { handleClose, model, feature: simpleFeature, viewType },
                ])
              }}
            >
              {`${feature.refName}:${feature.start} // ${locString} (split view)`}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function BreakendPanel(props: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { model, locStrings, feature } = props
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  let viewType: ViewType | undefined

  try {
    viewType = pluginManager.getViewType('BreakpointSplitView')
  } catch (e) {
    // ignore
  }

  return (
    <BaseCard {...props} title="Breakends">
      <LocStringList model={model} locStrings={locStrings} />
      {viewType ? (
        <LaunchBreakpointSplitViewPanel
          viewType={viewType}
          model={model}
          locStrings={locStrings}
          feature={feature}
        />
      ) : null}
    </BaseCard>
  )
}
