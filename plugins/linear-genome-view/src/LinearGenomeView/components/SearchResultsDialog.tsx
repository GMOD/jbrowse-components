import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  List,
  ListItem,
  DialogContent,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { LinearGenomeViewModel } from '../..'

export const useStyles = makeStyles(theme => ({
  expansionPanelDetails: {
    display: 'block',
    padding: theme.spacing(1),
  },
  expandIcon: {
    color: '#FFFFFF',
  },
  field: {
    display: 'flex',
  },
  fieldName: {
    wordBreak: 'break-all',
    minWidth: 100,
    maxWidth: 350,
    borderBottom: '1px solid #0003',
    backgroundColor: theme.palette.grey[200],
    marginRight: theme.spacing(1),
    padding: theme.spacing(0.5),
  },
  fieldValue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    padding: theme.spacing(0.5),
    overflow: 'auto',
  },
  fieldSubvalue: {
    wordBreak: 'break-word',
    maxHeight: 300,
    padding: theme.spacing(0.5),
    backgroundColor: theme.palette.grey[100],
    border: `1px solid ${theme.palette.grey[300]}`,
    boxSizing: 'border-box',
    overflow: 'auto',
  },
}))
export default function SearchResultsDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  // const session = getSession(model)

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogContent>
        <List>
          {model.searchResults.map((result: BaseResult, index) => (
            <ListItem key={`${result.getRendering()}-${index}`}>
              {`${result.getRendering()}`}
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="primary"
          autoFocus
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
