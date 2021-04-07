/* eslint-disable react/prop-types,@typescript-eslint/no-explicit-any,no-nested-ternary */
import React from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  DialogContent,
  DialogTitle,
  Container,
  Typography,
  Divider,
  IconButton,
  TextField,
} from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import { getSession } from '@jbrowse/core/util'
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
  const session = getSession(model)
  // function handleClick(str) {
  //   model.navToLocString(str)
  //   handleClose()
  // }

  return (
    <Dialog
      open
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogContent>
        <List>
          {model.searchResults.map((result, index) => (
            <ListItem key={`${result.value}-${index}`}>
              {`${result.inputValue}`}
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
