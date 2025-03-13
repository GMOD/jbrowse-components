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
  const { error, initialized, hasDisplayedRegions } = model

  if (!initialized && !error) {
    return <LoadingEllipses variant="h6" />
  } else if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  } else {
    return <LinearGenomeViewContainer model={model} />
  }
})

export default LinearGenomeView
