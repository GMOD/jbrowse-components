import React, { lazy } from 'react'
import { SimpleFeature, getSession, toLocale } from '@jbrowse/core/util'
import { Typography, Link } from '@mui/material'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory'
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

export default function LaunchPairedEndBreakpointSplitViewPanel({
  model,
  feature,
  viewType,
}: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
  viewType: ViewType
}) {
  const session = getSession(model)
  const f1 = {
    uniqueId: feature.uniqueId,
    refName: feature.refName,
    start: feature.start,
    end: feature.end,
    strand: feature.strand,
  }
  const f2 = {
    uniqueId: `${feature.id}-mate`,
    refName: feature.next_ref as string,
    start: feature.next_pos as number,
    end: (feature.next_pos as number) + 1,
    strand: feature.strand as number,
  }
  return (
    <div>
      <Typography>Launch split view</Typography>
      <ul>
        <li>
          {f1.refName}:{toLocale(f1.start)} -&gt; {f2.refName}:
          {toLocale(f2.start)}{' '}
          <Link
            href="#"
            onClick={event => {
              event.preventDefault()
              session.queueDialog(handleClose => [
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
          </Link>{' '}
          <Link
            href="#"
            onClick={event => {
              event.preventDefault()
              session.queueDialog(handleClose => [
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
        </li>
      </ul>
    </div>
  )
}
