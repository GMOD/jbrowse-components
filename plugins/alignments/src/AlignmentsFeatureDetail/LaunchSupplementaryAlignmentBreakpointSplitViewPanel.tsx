import { ErrorBanner } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import BreakpointPair, { junctionLocations } from './BreakpointPair.tsx'
import { getSAFeatures } from './getSAFeatures.ts'
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
              {/* the junction between two read-adjacent segments: where the
                  first one leaves the reference, and where the next resumes */}
              <BreakpointPair
                from={junctionLocations(f1).downstream}
                to={junctionLocations(f2).upstream}
              />{' '}
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
