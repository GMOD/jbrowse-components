import React, { Suspense, useRef, useState } from 'react'
import { Button, DialogContent, DialogActions, Typography } from '@mui/material'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// locals
import { useFeatureSequence } from '../hooks'
import { SimpleFeatureSerialized } from '../../../util'
import { BaseFeatureWidgetModel } from '../../stateModelFactory'
import SequencePanel from '../SequencePanel'
import SequenceFeatureMenu from './SequenceFeatureMenu'
import SequenceTypeSelector from './SequenceTypeSelector'

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

  const [mode, setMode] = useState('cds')
  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => handleClose()}
      title="Sequence view"
    >
      <DialogContent className={classes.dialogContent}>
        <div>
          <SequenceTypeSelector
            mode={mode}
            setMode={setMode}
            feature={feature}
            model={sequenceFeatureDetails}
          />
          <SequenceFeatureMenu
            mode={mode}
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
          ) : sequence ? (
            'error' in sequence ? (
              <>
                <Typography color="error">{sequence.error}</Typography>
                <Button
                  variant="contained"
                  color="inherit"
                  onClick={() => setForce(true)}
                >
                  Force load
                </Button>
              </>
            ) : (
              <Suspense fallback={<LoadingEllipses />}>
                <SequencePanel
                  ref={seqPanelRef}
                  feature={feature}
                  mode={mode}
                  sequence={sequence}
                  model={sequenceFeatureDetails}
                />
              </Suspense>
            )
          ) : (
            <Typography>No sequence found</Typography>
          )}
        </div>
      </DialogContent>

      <DialogActions>
        <Button onClick={() => handleClose()} variant="contained">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SequenceDialog
