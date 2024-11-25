import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  Divider,
  Typography,
} from '@mui/material'

import SearchResultsTable from './SearchResultsTable'
import type { LinearGenomeViewModel } from '../..'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

export default function SearchResultsDialog({
  model,
  assemblyName,
  searchQuery,
  searchResults,
  handleClose,
}: {
  model: LinearGenomeViewModel
  assemblyName?: string
  searchQuery: string
  searchResults?: BaseResult[]
  handleClose: () => void
}) {
  return (
    <Dialog open maxWidth="xl" onClose={handleClose} title="Search results">
      <DialogContent>
        {!searchResults?.length ? (
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
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="primary"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
