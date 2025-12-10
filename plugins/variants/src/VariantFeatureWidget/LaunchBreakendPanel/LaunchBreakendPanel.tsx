import { lazy } from 'react'

import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import { SimpleFeature, getEnv, getSession } from '@jbrowse/core/util'
import { Link, Typography } from '@mui/material'

import type { VariantFeatureWidgetModel } from '../stateModelFactory'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

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
}: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const session = getSession(model)
  const simpleFeature = new SimpleFeature(feature)
  const assemblyName = model.view?.displayedRegions[0]?.assemblyName

  const launchDialog = (
    Dialog: typeof BreakendMultiLevelOptionDialog,
    viewType: string,
  ) => {
    session.queueDialog(handleClose => [
      Dialog,
      {
        handleClose,
        session,
        feature: simpleFeature,
        stableViewId: `${model.id}_${assemblyName}_breakpointsplitview_${viewType}`,
        view: model.view,
        assemblyName,
      },
    ])
  }

  return (
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
                launchDialog(BreakendMultiLevelOptionDialog, 'multilevel')
              }}
            >
              (top/bottom)
            </Link>{' '}
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                launchDialog(BreakendSingleLevelOptionDialog, 'singlelevel')
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

export default function LaunchBreakendPanel(props: {
  locStrings: string[]
  model: VariantFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { model, locStrings, feature } = props
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  let hasBreakpointSplitView = false

  try {
    hasBreakpointSplitView = !!pluginManager.getViewType('BreakpointSplitView')
  } catch (e) {
    // ignore
  }

  return (
    <BaseCard {...props} title="Breakends">
      <LocStringList model={model} locStrings={locStrings} />
      {hasBreakpointSplitView ? (
        <LaunchBreakpointSplitViewPanel
          model={model}
          locStrings={locStrings}
          feature={feature}
        />
      ) : null}
    </BaseCard>
  )
}
