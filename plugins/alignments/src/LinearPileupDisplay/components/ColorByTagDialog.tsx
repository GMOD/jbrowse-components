import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

interface Tag {
  type: string
  tag: string
}

const ColorByTagDialog = observer(function ({
  model,
  handleClose,
}: {
  model: {
    setColorScheme: (arg: Tag) => void
  }
  handleClose: () => void
}) {
  const [tag, setTag] = useState('')
  const validTag = /^[A-Za-z][A-Za-z0-9]$/.exec(tag)

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
          onChange={event => {
            setTag(event.target.value)
          }}
          placeholder="Enter tag name"
          error={tag.length === 2 && !validTag}
          helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
          autoComplete="off"
          slotProps={{
            htmlInput: { maxLength: 2 },
          }}
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
