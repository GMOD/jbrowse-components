import React from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent, Divider } from '@mui/material'

export default function HelpDialog({
  handleClose,
}: {
  handleClose: () => void
}) {
  return (
    <Dialog
      open
      maxWidth="xl"
      onClose={handleClose}
      title="Using the search box"
    >
      <DialogContent>
        <h3>Searching</h3>
        <ul>
          <li>
            Jump to a feature or reference sequence by typing its name in the
            location box and pressing Enter.
          </li>
          <li>
            Jump to a specific region by typing the region into the location box
            as: <code>ref:start..end</code> or <code>ref:start-end</code>.
            Commas are allowed in the start and end coordinates. A
            space-separated list of locstrings can be used to open up multiple
            chromosomes at a time
          </li>
        </ul>
        <h3>Example Searches</h3>
        <ul>
          <li>
            <code>BRCA</code> - searches for the feature named BRCA
          </li>
          <li>
            <code>chr4</code> - jumps to chromosome 4
          </li>
          <li>
            <code>chr4:79,500,000..80,000,000</code> - jumps the region on
            chromosome 4 between 79.5Mb and 80Mb.
          </li>
          <li>
            <code>chr1:1-100 chr2:1-100</code> - create a split view of
            chr1:1-100 and chr2:1-100
          </li>
          <li>
            <code>chr1 chr2 chr3</code> - open up multiple chromosomes at once
          </li>
          <li>
            <code>chr1:1-100[rev] chr2:1-100</code> - open up the first region
            in the horizontally flipped orientation
          </li>
          <li>
            <code>chr1 100 200</code> - use whitespace separated refname, start,
            end
          </li>
        </ul>
      </DialogContent>
      <Divider />
      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
