import React, { Suspense, useRef, useState } from 'react'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { Button, DialogContent, DialogActions, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import SequencePanel from '../SequencePanel'
import { useFeatureSequence } from '../hooks'
import SequenceFeatureMenu from './SequenceFeatureMenu'
import SequenceTypeSelector from './SequenceTypeSelector'
import type { SimpleFeatureSerialized } from '../../../util'
import type { BaseFeatureWidgetModel } from '../../stateModelFactory'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const SequenceDialog = observer(function ({
  handleClose,
  model,
  feature,
}: {
  handleClose: () => void
  feature: SimpleFeatureSerialized
  model: BaseFeatureWidgetModel
}) {
  const { sequenceFeatureDetails } = model
  const { upDownBp } = sequenceFeatureDetails
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const [force, setForce] = useState(false)
  const { sequence, error } = useFeatureSequence(
    model,
    feature,
    upDownBp,
    force,
  )

  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => {
        handleClose()
      }}
      title="Sequence view"
    >
      <DialogContent className={classes.dialogContent}>
        <div>
          <SequenceTypeSelector model={sequenceFeatureDetails} />
          <SequenceFeatureMenu
            ref={seqPanelRef}
            model={sequenceFeatureDetails}
          />
        </div>

        <div>
          {feature.type === 'gene' ? (
            <Typography>
              Note: inspect subfeature sequences for protein/CDS computations
            </Typography>
          ) : null}
          {error ? (
            <ErrorMessage error={error} />
          ) : !sequence ? (
            <LoadingEllipses />
          ) : 'error' in sequence ? (
            <>
              <Typography color="error">{sequence.error}</Typography>
              <Button
                variant="contained"
                color="inherit"
                onClick={() => {
                  setForce(true)
                }}
              >
                Force load
              </Button>
            </>
          ) : (
            <Suspense fallback={<LoadingEllipses />}>
              <SequencePanel
                ref={seqPanelRef}
                feature={feature}
                sequence={sequence}
                model={sequenceFeatureDetails}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SequenceDialog
