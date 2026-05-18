import { lazy } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import {
  SimpleFeature,
  getSession,
  toLocale,
  useFetch,
} from '@jbrowse/core/util'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Link, Typography } from '@mui/material'

import { getSAFeatures } from './getSAFeatures.ts'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

const BreakpointSplitViewChoiceDialog = lazy(
  () => import('./BreakpointSplitViewChoiceDialog.tsx'),
)

export default function LaunchBreakpointSplitViewPanel({
  model,
  feature,
}: {
  model: AlignmentFeatureWidgetModel
  feature: AlignmentFeatureSerialized
}) {
  const { view } = model
  const { data: res, error } = useFetch(
    ['getSAFeatures', feature.uniqueId],
    () => getSAFeatures({ view, feature }),
  )
  const adjacentPairs = res
    ? res.slice(0, -1).map((f, i) => [f, res[i + 1]!] as const)
    : []
  const session = getSession(model)
  const assemblyName = getAssemblyName(model.view)
  return adjacentPairs.length && assemblyName ? (
    <div>
      <Typography>Launch split view</Typography>
      {error ? <ErrorBanner error={error} /> : null}
      <ul>
        {adjacentPairs.map(([f1, f2]) => (
          <li key={`${f1.uniqueId}-${f2.uniqueId}`}>
            {f1.refName}:{toLocale(f1.strand === 1 ? f1.end : f1.start)} -&gt;{' '}
            {f2.refName}:{toLocale(f2.strand === 1 ? f2.start : f2.end)}{' '}
            <Link
              href="#"
              onClick={event => {
                event.preventDefault()
                session.queueDialog(handleClose => [
                  BreakpointSplitViewChoiceDialog,
                  {
                    handleClose,
                    session,
                    feature: new SimpleFeature({ ...f1, mate: f2 }),
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
