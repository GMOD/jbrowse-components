import { ActionLink } from '@jbrowse/core/ui'
import { SimpleFeature, getSession, toLocale } from '@jbrowse/core/util'
import { getAssemblyName, launchBreakpointSplitView } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

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
      <ActionLink
        onClick={() => {
          launchBreakpointSplitView({
            session,
            view: model.view,
            assemblyName,
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
          })
        }}
      >
        {refName}:{toLocale(start)} -&gt; {next_ref}:{toLocale(next_pos)}{' '}
        (breakpoint split view)
      </ActionLink>
    </div>
  ) : null
}
