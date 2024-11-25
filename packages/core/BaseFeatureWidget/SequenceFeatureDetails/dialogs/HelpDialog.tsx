import React from 'react'
import { Dialog } from '@jbrowse/core/ui'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import { Button, DialogContent, DialogActions, Typography } from '@mui/material'

export default function HelpDialog({
  handleClose,
}: {
  handleClose: () => void
}) {
  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => {
        handleClose()
      }}
      title="Feature sequence panel help"
    >
      <DialogContent>
        <Typography paragraph>
          The "Feature sequence" panel shows the underlying genomic sequence for
          a given feature, fetched from the reference genome.
        </Typography>
        <Typography>
          For gene features, this panel does special calculations to e.g. stitch
          together the coding sequence, the options are:
        </Typography>
        <ul>
          <li>CDS - shows the stitched together CDS sequences</li>
          <li>
            Protein - the translated coding sequence, with the "standard"
            genetic code
          </li>
          <li>
            cDNA - shows the 'copy DNA' of transcript, formed from exon
            sequences
          </li>
          <li>
            Genomic w/ introns +/- Nbp up+down stream - the sequence underlying
            the entire gene including including introns, with UTR and CDS
            highlighted
          </li>
        </ul>
        <Typography paragraph>
          For other feature types, the options are:
        </Typography>
        <ul>
          <li>
            Genomic +/- Nbp up+down stream - the reference genome sequence
            underlying the feature, with the up and downstream sequence
          </li>
        </ul>
        <Typography>
          Note 1: you can use the "gear icon" <SettingsIcon /> to edit the
          number of bp displayed up/downstream and in the intron region
        </Typography>
        <Typography>
          Note 2: The 'Copy HTML' function retains the colors from the sequence
          panel but cannot be pasted into some programs like notepad that only
          expect plain text.
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          autoFocus
          variant="contained"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
