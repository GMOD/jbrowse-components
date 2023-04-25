import React, { lazy, useState, Suspense } from 'react'
import { Button, FormControl, IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import { BaseProps } from './../types'
import { LoadingEllipses } from '../../ui'

// icons
import HelpIcon from '@mui/icons-material/Help'

// lazies
const HelpDlg = lazy(() => import('./SequenceHelpDialog'))
const SequenceFeatureDetails = lazy(() => import('./SequenceFeatureDetails'))

const useStyles = makeStyles()(theme => ({
  formControl: {
    margin: 0,
  },

  container2: {
    marginTop: theme.spacing(1),
  },
}))

// display the stitched-together sequence of a gene's CDS, cDNA, or protein
// sequence. this is a best effort and weird genomic phenomena could lead these
// to not be 100% accurate
export default function SequenceFeaturePanel({ model, feature }: BaseProps) {
  const { classes } = useStyles()
  const [shown, setShown] = useState(false)
  const [helpShown, setHelpShown] = useState(false)

  return !model ? null : (
    <div className={classes.container2}>
      <Button variant="contained" onClick={() => setShown(!shown)}>
        {shown ? 'Hide feature sequence' : 'Show feature sequence'}
      </Button>
      <FormControl className={classes.formControl}>
        <IconButton onClick={() => setHelpShown(true)}>
          <HelpIcon />
        </IconButton>
      </FormControl>
      <br />
      {shown ? (
        <Suspense fallback={<LoadingEllipses />}>
          <SequenceFeatureDetails
            key={feature.id}
            model={model}
            feature={feature}
          />
        </Suspense>
      ) : null}
      {helpShown ? (
        <Suspense fallback={<div />}>
          <HelpDlg handleClose={() => setHelpShown(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}
