import React, { lazy, useState, Suspense } from 'react'
import { Button, FormControl, IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { IAnyStateTreeNode } from 'mobx-state-tree'
import { observer } from 'mobx-react'

// locals
import { BaseProps } from './../types'
import { LoadingEllipses } from '../../ui'
import { getSession } from '../../util'

// icons
import HelpIcon from '@mui/icons-material/Help'

// lazies
const HelpDialog = lazy(() => import('./SequenceHelpDialog'))
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

const SequenceFeatureDetailsHelpButton = observer(function ({
  model,
}: {
  model: IAnyStateTreeNode
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  return (
    <FormControl className={classes.formControl}>
      <IconButton
        onClick={() =>
          session.queueDialog(handleClose => [HelpDialog, { handleClose }])
        }
      >
        <HelpIcon />
      </IconButton>
    </FormControl>
  )
})

// display the stitched-together sequence of a gene's CDS, cDNA, or protein
// sequence. this is a best effort and weird genomic phenomena could lead these
// to not be 100% accurate
export default function SequenceFeaturePanel({ model, feature }: BaseProps) {
  const { classes } = useStyles()
  const [shown, setShown] = useState(false)

  return !model ? null : (
    <div className={classes.container}>
      <Button variant="contained" onClick={() => setShown(!shown)}>
        {shown ? 'Hide feature sequence' : 'Show feature sequence'}
      </Button>
      <SequenceFeatureDetailsHelpButton model={model} />
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
    </div>
  )
}
