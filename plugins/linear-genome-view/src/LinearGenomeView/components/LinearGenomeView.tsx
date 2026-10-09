import { Suspense, lazy } from 'react'

import { ViewLoadingScreen } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import LinearGenomeViewContainer from './LinearGenomeViewContainer.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// lazies
const ImportForm = lazy(() => import('./ImportForm.tsx'))
const SearchResultsDialog = lazy(() => import('./SearchResultsDialog.tsx'))

const LinearGenomeView = observer(function LinearGenomeView({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { loading, showImportForm, searchPicker } = model

  return (
    <>
      {loading ? (
        <ViewLoadingScreen {...loading} />
      ) : showImportForm ? (
        <ImportForm model={model} />
      ) : (
        <LinearGenomeViewContainer model={model} />
      )}
      {searchPicker ? (
        <Suspense fallback={null}>
          <SearchResultsDialog model={model} />
        </Suspense>
      ) : null}
    </>
  )
})

export default LinearGenomeView
