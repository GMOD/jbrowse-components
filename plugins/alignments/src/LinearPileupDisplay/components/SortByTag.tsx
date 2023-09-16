import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogActions,
  DialogContent,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

const SortByTagDialog = observer(function (props: {
  model: { setSortedBy: Function }
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [tag, setTag] = useState('')
  const validTag = tag.match(/^[A-Za-z][A-Za-z0-9]$/)
  return (
    <Dialog open onClose={handleClose} title="Sort by tag">
      <DialogContent>
        <Typography>Set the tag to sort by</Typography>
        <Typography color="textSecondary">
          Examples: HP for haplotype, RG for read group, etc.
        </Typography>
        <TextField
          value={tag}
          onChange={event => setTag(event.target.value)}
          placeholder="Enter tag name"
          inputProps={{
            maxLength: 2,
            'data-testid': 'sort-tag-name-input',
          }}
          error={tag.length === 2 && !validTag}
          helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
          autoComplete="off"
          data-testid="sort-tag-name"
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
            onClick={() => handleClose()}
          >
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default SortByTagDialog
