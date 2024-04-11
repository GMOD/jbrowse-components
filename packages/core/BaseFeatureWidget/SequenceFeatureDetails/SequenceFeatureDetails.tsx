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
import { useLocalStorage } from '../../util'
import { useFeatureSequence } from './hooks'
import { BaseProps } from './../types'
import { ParentFeat } from '../util'
import { LoadingEllipses } from '../../ui'
import CascadingMenuButton from '../../ui/CascadingMenuButton'

// icons
import MoreVert from '@mui/icons-material/MoreVert'

// lazies
const SequencePanel = lazy(() => import('./SequencePanel'))
const SettingsDialog = lazy(() => import('./SettingsDialog'))
const HelpDialog = lazy(() => import('./HelpDialog'))

const useStyles = makeStyles()({
  formControl: {
    margin: 0,
    marginLeft: 8,
  },
  container2: {
    display: 'inline',
  },
})

// set the key on this component to feature.id to clear state after new feature
// is selected
export default function SequenceFeatureDetails({
  model,
  feature: prefeature,
}: BaseProps) {
  const { classes } = useStyles()
  const feature = prefeature as unknown as ParentFeat
  const seqPanelRef = useRef<HTMLDivElement>(null)
  const [intronBp, setIntronBp] = useLocalStorage('intronBp', 10)
  const [upDownBp, setUpDownBp] = useLocalStorage('upDownBp', 500)
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [advancedDialogOpen, setAdvancedDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)
  const [force, setForce] = useState(false)
  const hasCDS = feature.subfeatures?.some(sub => sub.type === 'CDS')
  const hasExon = feature.subfeatures?.some(sub => sub.type === 'exon')
  const hasExonOrCDS = hasExon || hasCDS
  const { sequence, error } = useFeatureSequence(
    model,
    prefeature,
    upDownBp,
    force,
  )

  const [mode, setMode] = useState(
    hasCDS ? 'cds' : hasExon ? 'cdna' : 'genomic',
  )

  const rest = {
    ...(hasCDS ? { cds: 'CDS' } : {}),
    ...(hasCDS ? { protein: 'Protein' } : {}),
    ...(hasExonOrCDS ? { cdna: 'cDNA' } : {}),
    ...(hasExonOrCDS ? { gene: `Genomic w/ full introns` } : {}),
    ...(hasExonOrCDS
      ? {
          gene_updownstream: `Genomic w/ full introns +/- ${upDownBp}bp up+down stream`,
        }
      : {}),
    ...(hasExonOrCDS
      ? { gene_collapsed_intron: `Genomic w/ ${intronBp}bp intron` }
      : {}),
    ...(hasExonOrCDS
      ? {
          gene_updownstream_collapsed_intron: `Genomic w/ ${intronBp}bp intron +/- ${upDownBp}bp up+down stream `,
        }
      : {}),

    ...(!hasExonOrCDS ? { genomic: 'Genomic' } : {}),
    ...(!hasExonOrCDS
      ? {
          genomic_sequence_updownstream: `Genomic +/- ${upDownBp}bp up+down stream`,
        }
      : {}),
  }

  return (
    <div className={classes.container2}>
      <FormControl className={classes.formControl}>
        <Select value={mode} onChange={event => setMode(event.target.value)}>
          {Object.entries(rest).map(([key, val]) => (
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

      <br />
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
                setIntronBp(intronBp)
                setUpDownBp(upDownBp)
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
          <HelpDialog handleClose={() => setHelpDialogOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  )
}
