import { lazy } from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
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
  const { showLoading, showImportForm, loadingMessage } = model

  if (showLoading) {
    return <LoadingEllipses variant="h6" message={loadingMessage} />
  } else if (showImportForm) {
    return <ImportForm model={model} />
  } else {
    return <LinearGenomeViewContainer model={model} />
  }
})

export default LinearGenomeView
