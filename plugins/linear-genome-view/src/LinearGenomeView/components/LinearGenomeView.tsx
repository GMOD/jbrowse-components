import { lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import LinearGenomeViewContainer from './LinearGenomeViewContainer'

import type { LinearGenomeViewModel } from '..'

// lazies
const ImportForm = lazy(() => import('./ImportForm'))

const LinearGenomeView = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { error, init, initialized, hasDisplayedRegions } = model

  // Show loading if no error and either:
  // 1. Regions exist but not yet initialized (e.g., share link waiting for
  //    assemblies to load)
  // 2. init is set (waiting for autorun to navigate, will populate regions)
  if (!error && ((!initialized && hasDisplayedRegions) || init)) {
    return <LoadingEllipses variant="h6" />
  } else if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  } else {
    return <LinearGenomeViewContainer model={model} />
  }
})

export default LinearGenomeView
