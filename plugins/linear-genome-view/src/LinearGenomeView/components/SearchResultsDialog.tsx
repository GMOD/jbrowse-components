import { InfoDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SearchResultsTable from './SearchResultsTable.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const SearchResultsDialog = observer(function SearchResultsDialog({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { searchPicker } = model
  return searchPicker ? (
    <InfoDialog
      open
      maxWidth="xl"
      onClose={model.closeSearchPicker}
      title="Search results"
    >
      <Typography>
        Showing results for <b>{searchPicker.query}</b>
      </Typography>
      <SearchResultsTable picker={searchPicker} />
    </InfoDialog>
  ) : null
})

export default SearchResultsDialog
