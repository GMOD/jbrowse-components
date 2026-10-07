import { InfoDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SearchResultsTable from './SearchResultsTable.tsx'

import type { LinearGenomeViewModel } from '../../index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

const SearchResultsDialog = observer(function SearchResultsDialog({
  model,
  assemblyName,
  searchQuery,
  searchResults,
  handleClose,
  onPick,
}: {
  model: LinearGenomeViewModel
  assemblyName: string
  searchQuery: string
  searchResults: BaseResult[]
  handleClose: () => void
  onPick: (result: BaseResult) => Promise<unknown>
}) {
  return (
    <InfoDialog open maxWidth="xl" onClose={handleClose} title="Search results">
      {!searchResults.length ? (
        <Typography>
          No results found for <b>{searchQuery}</b>
        </Typography>
      ) : (
        <>
          <Typography>
            Showing results for <b>{searchQuery}</b>
          </Typography>
          <SearchResultsTable
            model={model}
            handleClose={handleClose}
            assemblyName={assemblyName}
            searchResults={searchResults}
            onPick={onPick}
          />
        </>
      )}
    </InfoDialog>
  )
})

export default SearchResultsDialog
