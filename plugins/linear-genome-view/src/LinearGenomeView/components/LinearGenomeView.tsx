import { lazy } from 'react'

import { ViewLoadingScreen } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import LinearGenomeViewContainer from './LinearGenomeViewContainer.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// lazies
const ImportForm = lazy(() => import('./ImportForm.tsx'))

const LinearGenomeView = observer(function LinearGenomeView({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { showLoading, showImportForm, loadingMessage, loadingProgress } = model

  if (showLoading) {
    return (
      <ViewLoadingScreen
        message={loadingMessage}
        fraction={loadingProgress}
        source={model.loadingSource}
      />
    )
  } else if (showImportForm) {
    return <ImportForm model={model} />
  } else {
    return <LinearGenomeViewContainer model={model} />
  }
})

export default LinearGenomeView
