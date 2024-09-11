import React, { lazy, useEffect, useState } from 'react'
import { Typography, Link, Tooltip } from '@mui/material'
import {
  SimpleFeature,
  SimpleFeatureSerialized,
  getSession,
  toLocale,
} from '@jbrowse/core/util'
import { ErrorMessage } from '@jbrowse/core/ui'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'

// locals
import { AlignmentFeatureWidgetModel } from './stateModelFactory'
import { ReducedFeature, getSAFeatures } from './getSAFeatures'

// lazies
const BreakendOptionDialog = lazy(() => import('./BreakendOptionDialog'))

export default function LaunchBreakpointSplitViewPanel({
  model,
  feature,
  viewType,
}: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
  viewType: ViewType
}) {
  const session = getSession(model)
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
      <Typography>
        Launch split views with breakend source and target
      </Typography>
      {error ? <ErrorMessage error={error} /> : null}
      <ul>
        {ret.map((arg, index) => {
          const [f1, f2] = arg
          return (
            <li key={`${JSON.stringify(arg)}-${index}`}>
              <Tooltip title="Top panel->Bottom panel">
                <Link
                  href="#"
                  onClick={event => {
                    event.preventDefault()
                    session.queueDialog(handleClose => [
                      BreakendOptionDialog,
                      {
                        handleClose,
                        model,
                        feature: new SimpleFeature({ ...f1, mate: f2 }),
                        // @ts-expect-error
                        viewType,
                        view: model.view,
                        assemblyName:
                          model.view.displayedRegions[0].assemblyName,
                      },
                    ])
                  }}
                >
                  {f1.refName}:{toLocale(f1.strand === 1 ? f1.end : f1.start)}{' '}
                  -&gt; {f2.refName}:
                  {toLocale(f2.strand === 1 ? f2.start : f2.end)}
                </Link>
              </Tooltip>
            </li>
          )
        })}
      </ul>
    </div>
  ) : null
}
