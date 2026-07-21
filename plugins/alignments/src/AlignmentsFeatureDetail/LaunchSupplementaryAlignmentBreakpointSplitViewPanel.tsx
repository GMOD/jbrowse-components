import { ErrorBanner } from '@jbrowse/core/ui'
import { SimpleFeature, toLocale, useFetch } from '@jbrowse/core/util'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getSAFeatures } from './getSAFeatures.ts'
import { LaunchBreakpointSplitViewLink } from './links.tsx'

import type { ReducedFeature } from './getSAFeatures.ts'
import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { AlignmentFeatureSerialized } from './util.ts'

// Reference coordinate of a segment's downstream (read-3') junction: its end on
// forward strand, start on reverse.
function downstreamBreakpoint(f: ReducedFeature) {
  return f.strand === 1 ? f.end : f.start
}

// Reference coordinate of a segment's upstream (read-5') junction: its start on
// forward strand, end on reverse.
function upstreamBreakpoint(f: ReducedFeature) {
  return f.strand === 1 ? f.start : f.end
}

const LaunchBreakpointSplitViewPanel = observer(
  function LaunchBreakpointSplitViewPanel({
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
    const assemblyName = getAssemblyName(model.view)
    return error ? (
      <ErrorBanner error={error} />
    ) : adjacentPairs.length && assemblyName ? (
      <div>
        <Typography>Launch split view</Typography>
        <ul>
          {adjacentPairs.map(([f1, f2]) => (
            <li key={`${f1.uniqueId}-${f2.uniqueId}`}>
              {f1.refName}:{toLocale(downstreamBreakpoint(f1))} -&gt;{' '}
              {f2.refName}:{toLocale(upstreamBreakpoint(f2))}{' '}
              <LaunchBreakpointSplitViewLink
                model={model}
                assemblyName={assemblyName}
                feature={new SimpleFeature({ ...f1, mate: f2 })}
              >
                (breakpoint split view)
              </LaunchBreakpointSplitViewLink>
            </li>
          ))}
        </ul>
      </div>
    ) : null
  },
)

export default LaunchBreakpointSplitViewPanel
