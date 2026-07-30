import { InfoDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

import SearchResultsTable from './SearchResultsTable.tsx'

import type { LinearGenomeViewModel } from '../../index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

export default function SearchResultsDialog({
  model,
  assemblyName,
  searchQuery,
  searchResults,
  handleClose,
}: {
  model: LinearGenomeViewModel
  assemblyName: string
  searchQuery: string
  searchResults: BaseResult[]
  handleClose: () => void
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
          />
        </>
      )}
    </InfoDialog>
  )
}
