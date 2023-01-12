import React, { useState } from 'react'
import { observer } from 'mobx-react'
import Button from '@mui/material/Button'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Dialog from '@jbrowse/core/ui/Dialog'

function ColorByTagDlg(props: {
  model: { setColorScheme: Function }
  handleClose: () => void
}) {
  const { model, handleClose } = props
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
          inputProps={{
            maxLength: 2,
            'data-testid': 'color-tag-name-input',
          }}
          error={tag.length === 2 && !validTag}
          helperText={tag.length === 2 && !validTag ? 'Not a valid tag' : ''}
          autoComplete="off"
          data-testid="color-tag-name"
        />
        <DialogActions>
          <Button
            variant="contained"
            color="primary"
            onClick={() => {
              model.setColorScheme({
                type: 'tag',
                tag,
              })
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
}

export default observer(ColorByTagDlg)
