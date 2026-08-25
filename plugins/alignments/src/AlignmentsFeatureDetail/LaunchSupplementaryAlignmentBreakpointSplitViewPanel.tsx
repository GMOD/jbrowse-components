import { ErrorBanner } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { getAssemblyName } from '@jbrowse/sv-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import BreakpointPair from './BreakpointPair.tsx'
import { getSAFeatures } from './getSAFeatures.ts'
import { LaunchBreakpointSplitViewLink } from './links.tsx'
import { splitReadJunctions } from './splitReadJunctions.ts'

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
    const junctions = res ? splitReadJunctions(res, feature.strand) : []
    const assemblyName = getAssemblyName(model.view)
    return error ? (
      <ErrorBanner error={error} />
    ) : junctions.length && assemblyName ? (
      <div>
        <Typography>Launch split view</Typography>
        <ul>
          {junctions.map(({ f1, f2, from, to }) => (
            <li key={`${f1.uniqueId}-${f2.uniqueId}`}>
              <BreakpointPair from={from} to={to} />{' '}
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
