import { lazy } from 'react'

import { SimpleFeature, getSession, toLocale } from '@jbrowse/core/util'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Link, Typography } from '@mui/material'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

const BreakpointSplitViewChoiceDialog = lazy(
  () => import('./BreakpointSplitViewChoiceDialog'),
)

export default function LaunchPairedEndBreakpointSplitViewPanel({
  model,
  feature,
}: {
  model: AlignmentFeatureWidgetModel
  feature: SimpleFeatureSerialized
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
  const assemblyName = getAssemblyName(model.view)
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
      </ul>
    </div>
  )
}
