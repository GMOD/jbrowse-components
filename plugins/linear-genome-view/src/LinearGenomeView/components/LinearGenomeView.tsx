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
  const { showLoading, hasDisplayedRegions, error, loadingMessage } = model

  if (showLoading) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  } else {
    return <LinearGenomeViewContainer model={model} />
  }
})

export default LinearGenomeView
