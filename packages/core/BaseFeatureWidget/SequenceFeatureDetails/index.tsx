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

  container: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(4),
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
    <div className={classes.container}>
      <Button variant="contained" onClick={() => setShown(!shown)}>
        {shown ? 'Hide feature sequence' : 'Show feature sequence'}
      </Button>
      <FormControl className={classes.formControl}>
        <IconButton onClick={() => setHelpShown(true)}>
          <HelpIcon />
        </IconButton>
      </FormControl>
      {shown ? (
        <Suspense fallback={<LoadingEllipses />}>
          <SequenceFeatureDetails
            /* eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion */
            key={feature.uniqueId as string}
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
