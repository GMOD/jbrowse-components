import { lazy } from 'react'

import { SimpleFeature, getSession, toLocale } from '@jbrowse/core/util'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Link, Typography } from '@mui/material'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

const BreakpointSplitViewChoiceDialog = lazy(
  () => import('./BreakpointSplitViewChoiceDialog.tsx'),
)

export default function LaunchPairedEndBreakpointSplitViewPanel({
  model,
  feature,
}: {
  model: AlignmentFeatureWidgetModel
  feature: AlignmentFeatureSerialized
}) {
  const session = getSession(model)
  const { uniqueId, refName, start, end, strand, next_ref, next_pos, id } =
    feature
  const assemblyName = getAssemblyName(model.view)
  return assemblyName && next_ref !== undefined && next_pos !== undefined ? (
    <div>
      <Typography>Launch split view</Typography>
      <ul>
        <li>
          {refName}:{toLocale(start)} -&gt; {next_ref}:{toLocale(next_pos)}{' '}
          <Link
            href="#"
            onClick={event => {
              event.preventDefault()
              session.queueDialog(handleClose => [
                BreakpointSplitViewChoiceDialog,
                {
                  handleClose,
                  session,
                  feature: new SimpleFeature({
                    uniqueId,
                    refName,
                    start,
                    end,
                    strand,
                    mate: {
                      uniqueId: `${id}-mate`,
                      refName: next_ref,
                      start: next_pos,
                      end: next_pos + 1,
                      strand,
                    },
                  }),
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
  ) : null
}
