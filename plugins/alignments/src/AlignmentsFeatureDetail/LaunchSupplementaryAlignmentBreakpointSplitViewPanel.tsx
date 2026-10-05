import { SimpleFeature } from '@jbrowse/core/util'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { splitAlignmentSegments } from '../shared/splitAlignment.ts'
import BreakpointPair, { junctionLocations } from './BreakpointPair.tsx'
import { LaunchBreakpointSplitViewLink } from './links.tsx'

import type { AlignedSegment } from '../shared/splitAlignment.ts'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

// The two segments either side of a junction as the read-plus-mate feature the
// split view frames, the shape `buildPairedEndMateFeature` gives a pair.
function junctionFeature(
  feature: AlignmentFeatureSerialized,
  f1: AlignedSegment,
  f2: AlignedSegment,
) {
  return new SimpleFeature({
    uniqueId: `${feature.uniqueId}-${f1.clip}`,
    name: feature.name,
    refName: f1.refName,
    start: f1.start,
    end: f1.end,
    strand: f1.strand,
    mate: {
      uniqueId: `${feature.uniqueId}-${f2.clip}`,
      refName: f2.refName,
      start: f2.start,
      end: f2.end,
      strand: f2.strand,
    },
  })
}

const LaunchBreakpointSplitViewPanel = observer(
  function LaunchBreakpointSplitViewPanel({
    model,
    feature,
  }: {
    model: AlignmentFeatureWidgetModel
    feature: AlignmentFeatureSerialized
  }) {
    const assemblyName = getAssemblyName(model.view)
    const segments = splitAlignmentSegments(new SimpleFeature(feature))
    return segments.length > 1 && assemblyName ? (
      <div>
        <Typography>Launch split view</Typography>
        <ul>
          {segments.slice(0, -1).map((f1, i) => {
            const f2 = segments[i + 1]!
            return (
              <li key={f1.clip}>
                <BreakpointPair
                  from={junctionLocations(f1).downstream}
                  to={junctionLocations(f2).upstream}
                />{' '}
                <LaunchBreakpointSplitViewLink
                  model={model}
                  assemblyName={assemblyName}
                  feature={junctionFeature(feature, f1, f2)}
                >
                  (breakpoint split view)
                </LaunchBreakpointSplitViewLink>
              </li>
            )
          })}
        </ul>
      </div>
    ) : null
  },
)

export default LaunchBreakpointSplitViewPanel
