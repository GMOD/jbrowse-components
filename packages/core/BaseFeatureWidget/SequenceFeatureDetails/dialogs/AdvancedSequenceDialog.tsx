import React, { Suspense, useRef, useState } from 'react'
import {
  Button,
  DialogContent,
  DialogActions,
  FormControl,
  MenuItem,
  Select,
  Typography,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'

// locals
import { useFeatureSequence } from '../hooks'
import { SimpleFeatureSerialized } from '../../../util'
import { BaseFeatureWidgetModel } from '../../stateModelFactory'
import AdvancedSequencePanel from './AdvancedSequencePanel'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

const AdvancedSequenceDialog = observer(function ({
  handleClose,
  model,
  feature,
}: {
  handleClose: () => void
  feature: SimpleFeatureSerialized
  model: BaseFeatureWidgetModel
}) {
  const { sequenceFeatureDetails } = model
  const { intronBp, upDownBp, showCoordinates } = sequenceFeatureDetails
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)

  const [force, setForce] = useState(false)
  const hasCDS = feature.subfeatures?.some(sub => sub.type === 'CDS')
  const hasExon = feature.subfeatures?.some(sub => sub.type === 'exon')
  const hasExonOrCDS = hasExon || hasCDS
  const { sequence, error } = useFeatureSequence(
    model,
    feature,
    upDownBp,
    force,
  )

  const [mode, setMode] = useState(
    hasCDS ? 'cds' : hasExon ? 'cdna' : 'genomic',
  )
  return (
    <Dialog
      maxWidth="xl"
      open
      onClose={() => handleClose()}
      title="Advanced sequence view dialog"
    >
      <DialogContent className={classes.dialogContent}>
        <div>
          <FormControlLabel
            label="Show coordinates"
            control={
              <Checkbox
                checked={sequenceFeatureDetails.showCoordinates}
                onChange={() =>
                  sequenceFeatureDetails.setShowCoordinates(
                    !sequenceFeatureDetails.showCoordinates,
                  )
                }
              />
            }
          />
          <FormControl className={classes.formControl}>
            <Select
              size="small"
              value={mode}
              onChange={event => setMode(event.target.value)}
            >
              {Object.entries({
                ...(hasCDS
                  ? {
                      cds: 'CDS',
                    }
                  : {}),
                ...(hasCDS
                  ? {
                      protein: 'Protein',
                    }
                  : {}),
                ...(hasExonOrCDS
                  ? {
                      cdna: 'cDNA',
                    }
                  : {}),
                ...(hasExonOrCDS
                  ? {
                      gene: `Genomic w/ full introns`,
                    }
                  : {}),
                ...(hasExonOrCDS
                  ? {
                      gene_updownstream: `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
                    }
                  : {}),
                ...(hasExonOrCDS
                  ? {
                      gene_collapsed_intron: `Genomic w/ ${intronBp}bp intron`,
                    }
                  : {}),
                ...(hasExonOrCDS
                  ? {
                      gene_updownstream_collapsed_intron: `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream `,
                    }
                  : {}),

                ...(!hasExonOrCDS
                  ? {
                      genomic: 'Genomic',
                    }
                  : {}),
                ...(!hasExonOrCDS
                  ? {
                      genomic_sequence_updownstream: `Genomic +/- ${upDownBp}bp up+down stream`,
                    }
                  : {}),
              }).map(([key, val]) => (
                <MenuItem key={key} value={key}>
                  {val}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
                <AdvancedSequencePanel
                  ref={seqPanelRef}
                  showCoords={showCoordinates}
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

export default AdvancedSequenceDialog
