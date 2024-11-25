import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const SortByTagDialog = observer(function (props: {
  model: {
    setSortedBy: (arg: string, arg2: string) => void
  }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [tag, setTag] = useState('')
  const validTag = /^[A-Za-z][A-Za-z0-9]$/.exec(tag)
  return (
    <Dialog open onClose={handleClose} title="Sort by tag">
      <DialogContent>
        <Typography>Set the tag to sort by</Typography>
        <Typography color="textSecondary">
          Examples: HP for haplotype, RG for read group, etc.
        </Typography>
        <TextField
          value={tag}
          onChange={event => {
            setTag(event.target.value)
          }}
          placeholder="Enter tag name"
          error={tag.length === 2 && !validTag}
          helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
          autoComplete="off"
          data-testid="sort-tag-name"
          slotProps={{
            htmlInput: {
              maxLength: 2,
              'data-testid': 'sort-tag-name-input',
            },
          }}
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            autoFocus
            onClick={() => {
              model.setSortedBy('tag', tag)
              handleClose()
            }}
          >
            Submit
          </Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default SortByTagDialog
