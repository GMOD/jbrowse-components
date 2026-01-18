import { Alert } from '@mui/material'
import { observer } from 'mobx-react'

import SearchForm from './SearchForm.tsx'
import SearchResults from './SearchResults.tsx'

import type { SequenceSearchModel } from '../model.ts'

const SequenceSearchWidget = observer(function SequenceSearchWidget({
  model,
}: {
  model: SequenceSearchModel
}) {
  const { assemblyNames } = model

  if (assemblyNames.length === 0) {
    return (
      <Alert severity="warning">
        No assemblies configured. Please add an assembly to use sequence search.
      </Alert>
    )
  }

  return (
    <div>
      <SearchForm model={model} />
      <SearchResults model={model} />
    </div>
  )
})

export default SequenceSearchWidget
