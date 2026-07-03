import { ActionLink } from '@jbrowse/core/ui'
import { getSession, toLocale } from '@jbrowse/core/util'
import { getAssemblyName, launchBreakpointSplitView } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  buildPairedEndMateFeature,
  computeMateFields,
} from '../shared/mateFeature.ts'

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
    const { uniqueId, refName, start, end, strand, flags, next_ref, next_pos } =
      feature
    const assemblyName = getAssemblyName(model.view)
    const mate = computeMateFields({
      uniqueId,
      refName,
      start,
      end,
      strand,
      flags,
      nextRef: next_ref,
      nextPos: next_pos,
    })
    return assemblyName && mate ? (
      <div>
        <Typography>Launch split view</Typography>
        <ActionLink
          onClick={() => {
            launchBreakpointSplitView({
              session,
              view: model.view,
              assemblyName,
              feature: buildPairedEndMateFeature(mate),
            })
          }}
        >
          {refName}:{toLocale(start)} -&gt; {mate.nextRef}:
          {toLocale(mate.nextPos)} (breakpoint split view)
        </ActionLink>
      </div>
    ) : null
  },
)

export default LaunchPairedEndBreakpointSplitViewPanel
