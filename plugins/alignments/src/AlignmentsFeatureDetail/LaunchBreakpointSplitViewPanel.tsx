import React, { lazy, useEffect, useState } from 'react'
import { Typography, Link } from '@mui/material'
import {
  SimpleFeature,
  SimpleFeatureSerialized,
  getSession,
} from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { ErrorMessage } from '@jbrowse/core/ui'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'

// locals
import { AlignmentFeatureWidgetModel } from './stateModelFactory'
import { ReducedFeature, getSAFeatures } from './getSAFeatures'

// lazies
const BreakendOptionDialog = lazy(() => import('./BreakendOptionDialog'))

const useStyles = makeStyles()({
  cursor: {
    cursor: 'pointer',
  },
})
export default function LaunchBreakpointSplitViewPanel({
  model,
  feature,
  viewType,
}: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
  viewType: ViewType
}) {
  const { classes } = useStyles()
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
      ret.push([res[i], res[i + 1]] as const)
    }
  }
  return (
    <>
      {ret.length ? (
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
                  <Link
                    href="#"
                    className={classes.cursor}
                    onClick={event => {
                      event.preventDefault()
                      session.queueDialog(handleClose => [
                        BreakendOptionDialog,
                        { handleClose, f1, f2, model, viewType },
                      ])
                    }}
                  >
                    Top panel: {f1.refName}:{f1.start}-{f1.end} -&gt; Bottom
                    panel {f2.refName}:{f2.start}-{f2.end}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </>
  )
}
