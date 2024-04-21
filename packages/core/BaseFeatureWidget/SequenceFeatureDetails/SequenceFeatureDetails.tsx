import React, { lazy, useRef, useState, Suspense } from 'react'
import {
  Button,
  FormControl,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import copy from 'copy-to-clipboard'

// locals
import { useFeatureSequence } from './hooks'
import { BaseProps } from './../types'
import { ParentFeat } from '../util'
import { LoadingEllipses } from '../../ui'
import CascadingMenuButton from '../../ui/CascadingMenuButton'

// icons
import MoreVert from '@mui/icons-material/MoreVert'
import AdvancedSequenceDialog from './dialogs/AdvancedSequenceDialog'
import { BaseFeatureWidgetModel } from '../stateModelFactory'
import { SimpleFeatureSerialized } from '../../util'

// lazies
const SequencePanel = lazy(() => import('./SequencePanel'))
const SettingsDialog = lazy(() => import('./dialogs/SettingsDialog'))
const HelpDialog = lazy(() => import('./dialogs/HelpDialog'))

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 8,
  },
})

// set the key on this component to feature.id to clear state after new feature
// is selected
export default function SequenceFeatureDetails({
  model,
  feature,
}: {
  model: BaseFeatureWidgetModel
  feature: SimpleFeatureSerialized
}) {
  const { sequenceFeaturePanel } = model
  const { intronBp, upDownBp, upperCaseCDS } = sequenceFeaturePanel
  const { classes } = useStyles()
  const seqPanelRef = useRef<HTMLDivElement>(null)

  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
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
      <span>
        <FormControl className={classes.formControl}>
          <Select value={mode} onChange={event => setMode(event.target.value)}>
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

        <FormControl className={classes.formControl}>
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
                    copy(ref.innerHTML, { format: 'text/html' })
                  }
                },
              },
              {
                label: 'Upper case CDS and lower case everything else',
                checked: sequenceFeaturePanel.upperCaseCDS,
                onClick: () =>
                  sequenceFeaturePanel.setUpperCaseCDS(!upperCaseCDS),
              },
              {
                label: 'Advanced view',
                onClick: () => setAdvancedDialogOpen(true),
              },
              {
                label: 'Settings',
                onClick: () => setSettingsDialogOpen(true),
              },
              {
                label: 'Help',
                onClick: () => setHelpDialogOpen(true),
              },
            ]}
          >
            <MoreVert />
          </CascadingMenuButton>
        </FormControl>
      </span>
      <div>
        {feature.type === 'gene' ? (
          <Typography>
            Note: inspect subfeature sequences for protein/CDS computations
          </Typography>
        ) : null}
        {error ? (
          <Typography color="error">{`${error}`}</Typography>
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
                intronBp={intronBp}
              />
            </Suspense>
          )
        ) : (
          <Typography>No sequence found</Typography>
        )}
        {settingsDialogOpen ? (
          <Suspense fallback={null}>
            <SettingsDialog
              handleClose={arg => {
                if (arg) {
                  const { upDownBp, intronBp } = arg
                  sequenceFeaturePanel.setIntronBp(intronBp)
                  sequenceFeaturePanel.setUpDownBp(upDownBp)
                }
                setSettingsDialogOpen(false)
              }}
              upDownBp={upDownBp}
              intronBp={intronBp}
            />
          </Suspense>
        ) : null}
        {helpDialogOpen ? (
          <Suspense fallback={null}>
            <HelpDialog handleClose={() => setHelpDialogOpen(false)} />
          </Suspense>
        ) : null}
        {advancedDialogOpen ? (
          <Suspense fallback={null}>
            <AdvancedSequenceDialog
              handleClose={() => setHelpDialogOpen(false)}
            />
          </Suspense>
        ) : null}
      </div>
    </>
  )
}
