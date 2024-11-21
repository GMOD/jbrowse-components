import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

import { LinearGenomeViewModel } from '../..'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import SearchResultsTable from './SearchResultsTable'

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
