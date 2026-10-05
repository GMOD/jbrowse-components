import { SimpleFeature } from '@jbrowse/core/util'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  splitAlignmentSegments,
  splitReadLaunch,
} from '../shared/splitAlignment.ts'
import BreakpointPair, { junctionLocations } from './BreakpointPair.tsx'
import { LaunchBreakpointSplitViewLink } from './links.tsx'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

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
    if (segments.length < 2 || !assemblyName) {
      return null
    }
    const launch = splitReadLaunch(feature.uniqueId, feature.name, segments)
    return (
      <div>
        <Typography>Junctions, in read order</Typography>
        <ul>
          {segments.slice(0, -1).map((f1, i) => (
            <li key={f1.clip}>
              <BreakpointPair
                from={junctionLocations(f1).downstream}
                to={junctionLocations(segments[i + 1]!).upstream}
              />
            </li>
          ))}
        </ul>
        <LaunchBreakpointSplitViewLink
          model={model}
          assemblyName={assemblyName}
          feature={launch.feature}
          stops={launch.stops}
        >
          Open breakpoint split view, one panel per segment
        </LaunchBreakpointSplitViewLink>
      </div>
    )
  },
)

export default LaunchBreakpointSplitViewPanel
