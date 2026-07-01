import { ActionLink } from '@jbrowse/core/ui'
import { getSession, toLocale } from '@jbrowse/core/util'
import { getAssemblyName, launchBreakpointSplitView } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { buildPairedEndMateFeature } from '../shared/mateFeature.ts'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

const LaunchPairedEndBreakpointSplitViewPanel = observer(
  function LaunchPairedEndBreakpointSplitViewPanel({
    model,
    feature,
  }: {
    model: AlignmentFeatureWidgetModel
    feature: AlignmentFeatureSerialized
  }) {
    const session = getSession(model)
    const { uniqueId, refName, start, end, strand, next_ref, next_pos } =
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
              feature: buildPairedEndMateFeature({
                uniqueId,
                refName,
                start,
                end,
                strand,
                nextRef: next_ref,
                nextPos: next_pos,
              }),
            })
          }}
        >
          {refName}:{toLocale(start)} -&gt; {next_ref}:{toLocale(next_pos)}{' '}
          (breakpoint split view)
        </ActionLink>
      </div>
    ) : null
  },
)

export default LaunchPairedEndBreakpointSplitViewPanel
