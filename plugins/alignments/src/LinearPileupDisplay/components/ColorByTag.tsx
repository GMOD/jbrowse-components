import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material'
import { Dialog } from '@jbrowse/core/ui'

const ColorByTagDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    setColorScheme: (arg: { type: string; tag: string }) => void
  }
  handleClose: () => void
}) {
  const [tag, setTag] = useState('')
  const validTag = tag.match(/^[A-Za-z][A-Za-z0-9]$/)

  return (
    <Dialog open onClose={handleClose} title="Color by tag">
      <DialogContent style={{ overflowX: 'hidden' }}>
        <Typography>Enter tag to color by: </Typography>
        <Typography color="textSecondary">
          Examples: XS or TS for RNA-seq inferred read strand, ts (lower-case)
          for minimap2 read strand, HP for haplotype, RG for read group, etc.
        </Typography>

        <TextField
          value={tag}
          onChange={event => setTag(event.target.value)}
          placeholder="Enter tag name"
          inputProps={{ maxLength: 2 }}
          error={tag.length === 2 && !validTag}
          helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
          autoComplete="off"
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              model.setColorScheme({ type: 'tag', tag })
              handleClose()
            }}
            disabled={!validTag}
          >
            Submit
          </Button>
          <Button variant="contained" color="secondary" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  )
})

export default ColorByTagDialog
