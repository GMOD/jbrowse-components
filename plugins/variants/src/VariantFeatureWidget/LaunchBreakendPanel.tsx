import React, { lazy } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { SimpleFeature, getEnv, getSession } from '@jbrowse/core/util'
import { Link, Typography } from '@mui/material'

import type { VariantFeatureWidgetModel } from './stateModelFactory'
import type { ViewType } from '@jbrowse/core/pluggableElementTypes'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// locals

// lazies
const BreakendMultiLevelOptionDialog = lazy(
  () => import('./BreakendMultiLevelOptionDialog'),
)
const BreakendSingleLevelOptionDialog = lazy(
  () => import('./BreakendSingleLevelOptionDialog'),
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
  viewType,
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
  feature: SimpleFeatureSerialized
  viewType: ViewType
}) {
  const session = getSession(model)
  const simpleFeature = new SimpleFeature(feature)
  const assemblyName = model.view?.displayedRegions[0]?.assemblyName
  return (
    <div>
      <Typography>Launch split view</Typography>
      <ul>
        {locStrings.map(locString => (
          <li key={JSON.stringify(locString)}>
            {`${feature.refName}:${feature.start} // ${locString}`}{' '}
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                session.queueDialog(handleClose => [
                  BreakendMultiLevelOptionDialog,
                  {
                    handleClose,
                    session,
                    feature: simpleFeature,
                    stableViewId: `${model.id}_${assemblyName}_breakpointsplitview_multilevel`,
                    view: model.view,
                    assemblyName,
                  },
                ])
              }}
            >
              (top/bottom)
            </Link>{' '}
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                session.queueDialog(handleClose => [
                  BreakendSingleLevelOptionDialog,
                  {
                    handleClose,
                    session,
                    feature: simpleFeature,
                    stableViewId: `${model.id}_${assemblyName}_breakpointsplitview_singlelevel`,
                    view: model.view,
                    assemblyName,
                  },
                ])
              }}
            >
              (single row)
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
