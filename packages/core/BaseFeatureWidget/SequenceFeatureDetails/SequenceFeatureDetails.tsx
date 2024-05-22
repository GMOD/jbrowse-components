import React, { lazy, useRef, useState, Suspense } from 'react'
import {
  Button,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import copy from 'copy-to-clipboard'

// locals
import { useFeatureSequence } from './hooks'
import { ErrorMessage, LoadingEllipses } from '../../ui'
import { SimpleFeatureSerialized, getSession } from '../../util'
import { BaseFeatureWidgetModel } from '../stateModelFactory'
import CascadingMenuButton from '../../ui/CascadingMenuButton'

// icons
import MoreVert from '@mui/icons-material/MoreVert'
import Settings from '@mui/icons-material/Settings'

// lazies
const SequencePanel = lazy(() => import('./SequencePanel'))
const SettingsDialog = lazy(() => import('./dialogs/SettingsDialog'))
const SequenceDialog = lazy(() => import('./dialogs/SequenceDialog'))

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 4,
  },
})

// set the key on this component to feature.id to clear state after new feature
// is selected
const SequenceFeatureDetails = observer(function ({
  model,
  feature,
}: {
  model: BaseFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { sequenceFeatureDetails } = model
  const { intronBp, upDownBp } = sequenceFeatureDetails
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
    <>
      <div>
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
        <CascadingMenuButton
          menuItems={[
            {
              label: 'Copy plaintext',
              onClick: () => {
                const ref = seqPanelRef.current
                if (ref) {
                  copy(ref.textContent || '', { format: 'text/plain' })
                }
              },
            },
            {
              label: 'Copy HTML',
              onClick: () => {
                const ref = seqPanelRef.current
                if (ref) {
                  copy(ref.outerHTML, { format: 'text/html' })
                }
              },
            },
            {
              label: 'Open in dialog',
              onClick: () => {
                getSession(model).queueDialog(handleClose => [
                  SequenceDialog,
                  { model, feature, handleClose },
                ])
              },
            },
            {
              label: 'Settings',
              icon: Settings,
              onClick: () => {
                getSession(model).queueDialog(handleClose => [
                  SettingsDialog,
                  { model: sequenceFeatureDetails, handleClose },
                ])
              },
            },
            {
              label: 'Show coordinates',
              onClick: () =>
                sequenceFeatureDetails.setShowCoordinates(
                  !sequenceFeatureDetails.showCoordinates,
                ),
              checked: sequenceFeatureDetails.showCoordinates,
              type: 'checkbox',
            },
          ]}
        >
          <MoreVert />
        </CascadingMenuButton>
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
    </>
  )
})

export default SequenceFeatureDetails
