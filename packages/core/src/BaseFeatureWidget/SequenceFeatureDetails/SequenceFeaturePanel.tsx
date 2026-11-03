import { Suspense, lazy, useState } from 'react'

import ExpandMore from '@mui/icons-material/ExpandMore'
import Help from '@mui/icons-material/Help'
import { Button, FormControl, IconButton } from '@mui/material'
import { observer } from 'mobx-react'

import { LoadingEllipses } from '../../ui/index.ts'
import { getDialogHost, getSession } from '../../util/index.ts'
import { makeStyles } from '../../util/tss-react/index.ts'
import { panelAssemblyName } from './panelAssemblyName.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type { FeatureDetailsModel } from '../types.tsx'

// lazies
const SequenceFeatureDetails = lazy(
  () => import('./SequenceFeatureDetails.tsx'),
)
const HelpDialog = lazy(() => import('./dialogs/HelpDialog.tsx'))

const useStyles = makeStyles()(theme => ({
  formControl: {
    margin: 0,
  },

  container: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  chevron: {
    transition: 'transform 150ms',
  },
  closed: {
    transform: 'rotate(-90deg)',
  },
}))

// display the stitched-together sequence of a gene's CDS, cDNA, or protein
// sequence. this is a best effort and weird genomic phenomena could lead these
// to not be 100% accurate
const SequenceFeaturePanel = observer(function SequenceFeaturePanel({
  model,
  feature,
}: {
  model: FeatureDetailsModel
  feature: SimpleFeatureSerialized
}) {
  const { classes, cx } = useStyles()
  const [shown, setShown] = useState(false)

  return (
    <div className={classes.container}>
      <FormControl className={classes.formControl}>
        <Button
          size="small"
          aria-expanded={shown}
          startIcon={
            <ExpandMore
              className={cx(classes.chevron, !shown && classes.closed)}
            />
          }
          onClick={() => {
            setShown(val => !val)
          }}
        >
          {shown ? 'Hide feature sequence' : 'Show feature sequence'}
        </Button>
      </FormControl>

      <IconButton
        size="small"
        onClick={() => {
          getDialogHost(model).queueDialog(handleClose => [
            HelpDialog,
            {
              handleClose,
            },
          ])
        }}
      >
        <Help />
      </IconButton>
      {shown ? (
        <Suspense fallback={<LoadingEllipses />}>
          <SequenceFeatureDetails
            model={model.sequenceFeatureDetails}
            session={getSession(model)}
            assemblyName={panelAssemblyName({
              feature,
              viewAssemblyNames: model.view?.assemblyNames,
              assemblyManager: getSession(model).assemblyManager,
            })}
            feature={feature}
            hoverTarget={model}
            canonicalTranscripts={model.canonicalTranscripts}
          />
        </Suspense>
      ) : null}
    </div>
  )
})

export default SequenceFeaturePanel
