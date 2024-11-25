import React, { lazy, useEffect, useState } from 'react'
import { ErrorMessage } from '@jbrowse/core/ui'
import { SimpleFeature, getSession, toLocale } from '@jbrowse/core/util'
import { Typography, Link } from '@mui/material'
import { getSAFeatures } from './getSAFeatures'
import type { ReducedFeature } from './getSAFeatures'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory'
import type { ViewType } from '@jbrowse/core/pluggableElementTypes'

// locals
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// lazies
const BreakendMultiLevelOptionDialog = lazy(
  () => import('./BreakendMultiLevelOptionDialog'),
)
const BreakendSingleLevelOptionDialog = lazy(
  () => import('./BreakendSingleLevelOptionDialog'),
)

export default function LaunchBreakpointSplitViewPanel({
  model,
  feature,
  viewType,
}: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
  viewType: ViewType
}) {
  const { view } = model
  const [res, setRes] = useState<ReducedFeature[]>()
  const [error, setError] = useState<unknown>()
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        const feats = await getSAFeatures({
          view,
          feature: new SimpleFeature(feature),
        })
        setRes(feats)
      } catch (e) {
        setError(e)
        console.error(e)
      }
    })()
  }, [feature, view])

  const ret = [] as [ReducedFeature, ReducedFeature][]
  if (res) {
    for (let i = 0; i < res.length - 1; i++) {
      ret.push([res[i]!, res[i + 1]!] as const)
    }
  }
  return ret.length ? (
    <div>
      <Typography>Launch split view</Typography>
      {error ? <ErrorMessage error={error} /> : null}
      <ul>
        {ret.map((arg, index) => {
          const [f1, f2] = arg
          return (
            <li key={`${JSON.stringify(arg)}-${index}`}>
              {f1.refName}:{toLocale(f1.strand === 1 ? f1.end : f1.start)} -&gt;{' '}
              {f2.refName}:{toLocale(f2.strand === 1 ? f2.start : f2.end)}{' '}
              <TopBottomSplitViewLink
                model={model}
                f1={f1}
                f2={f2}
                viewType={viewType}
              />{' '}
              <SideBySideViewLink
                model={model}
                f1={f1}
                f2={f2}
                viewType={viewType}
              />
            </li>
          )
        })}
      </ul>
    </div>
  ) : null
}

function TopBottomSplitViewLink({
  model,
  f1,
  f2,
  viewType,
}: {
  model: AlignmentFeatureWidgetModel
  f1: ReducedFeature
  f2: ReducedFeature
  viewType: ViewType
}) {
  return (
    <Link
      href="#"
      onClick={event => {
        event.preventDefault()
        getSession(model).queueDialog(handleClose => [
          BreakendMultiLevelOptionDialog,
          {
            handleClose,
            model,
            feature: new SimpleFeature({ ...f1, mate: f2 }),
            // @ts-expect-error
            viewType,
            view: model.view,
            assemblyName: model.view.displayedRegions[0].assemblyName,
          },
        ])
      }}
    >
      (top/bottom)
    </Link>
  )
}

function SideBySideViewLink({
  model,
  f1,
  f2,
  viewType,
}: {
  model: AlignmentFeatureWidgetModel
  f1: ReducedFeature
  f2: ReducedFeature
  viewType: ViewType
}) {
  return (
    <Link
      href="#"
      onClick={event => {
        event.preventDefault()
        getSession(model).queueDialog(handleClose => [
          BreakendSingleLevelOptionDialog,
          {
            handleClose,
            model,
            feature: new SimpleFeature({ ...f1, mate: f2 }),
            // @ts-expect-error
            viewType,
            view: model.view,
            assemblyName: model.view.displayedRegions[0].assemblyName,
          },
        ])
      }}
    >
      (single row)
    </Link>
  )
}
