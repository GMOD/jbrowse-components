import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  FormGroup,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

const useStyles = makeStyles()({
  dialogContent: {
    width: '34em',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  row: {
    display: 'flex',
    gap: 12,
    '& > *': {
      flex: 1,
    },
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
})

// PAM 3' of the protospacer for Cas9-type enzymes, 5' for Cas12a; cutOffset is
// the bp from the PAM-proximal end of the protospacer to the predicted cut.
const ENZYME_PRESETS: Record<
  string,
  { pam: string; guideLength: number; pamLocation: string; cutOffset: number }
> = {
  SpCas9: { pam: 'NGG', guideLength: 20, pamLocation: '3prime', cutOffset: 3 },
  SaCas9: {
    pam: 'NNGRRT',
    guideLength: 21,
    pamLocation: '3prime',
    cutOffset: 3,
  },
  'Cas12a (Cpf1)': {
    pam: 'TTTV',
    guideLength: 23,
    pamLocation: '5prime',
    cutOffset: 18,
  },
}

const SequenceSearchDialog = observer(function SequenceSearchDialog({
  model,
  handleClose,
}: {
  model: {
    assemblyNames: string[]
    showTrack: (trackId: string) => void
  }
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [mode, setMode] = useState<'pattern' | 'crispr'>('pattern')

  const [value, setValue] = useState('')
  const [caseInsensitive, setCaseInsensitive] = useState(true)

  const [enzyme, setEnzyme] = useState('SpCas9')
  const [pam, setPam] = useState(ENZYME_PRESETS.SpCas9!.pam)
  const [pamLocation, setPamLocation] = useState(
    ENZYME_PRESETS.SpCas9!.pamLocation,
  )
  const [guideLengthStr, setGuideLengthStr] = useState(
    String(ENZYME_PRESETS.SpCas9!.guideLength),
  )
  const [cutOffsetStr, setCutOffsetStr] = useState(
    String(ENZYME_PRESETS.SpCas9!.cutOffset),
  )

  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)

  let patternError: unknown
  try {
    new RegExp(value)
  } catch (e) {
    patternError = e
  }

  const guideLength = Number(guideLengthStr)
  const cutOffset = Number(cutOffsetStr)
  const bothStrandsOff = !searchForward && !searchReverse
  const crisprValid =
    !!pam &&
    Number.isFinite(guideLength) &&
    guideLength > 0 &&
    Number.isFinite(cutOffset)
  const canSubmit =
    !bothStrandsOff &&
    (mode === 'pattern' ? !!value && !patternError : crisprValid)

  const presetSummary = ENZYME_PRESETS[enzyme]
    ? `PAM ${pam} · ${guideLength} bp guide · cut ${cutOffset} bp from PAM`
    : 'Set a custom PAM and geometry below'

  function applyPreset(name: string) {
    setEnzyme(name)
    const preset = ENZYME_PRESETS[name]
    if (preset) {
      setPam(preset.pam)
      setPamLocation(preset.pamLocation)
      setGuideLengthStr(String(preset.guideLength))
      setCutOffsetStr(String(preset.cutOffset))
    }
  }

  function handleSubmit() {
    const session = getSession(model)
    const { assemblyManager } = session
    const assemblyName = model.assemblyNames[0]!
    if (isSessionWithAddTracks(session)) {
      const sequenceAdapter = getSnapshot(
        assemblyManager.get(assemblyName)?.configuration.sequence.adapter,
      )
      const shared = {
        trackId:
          mode === 'pattern'
            ? `sequence_search_${Date.now()}`
            : `crispr_guides_${Date.now()}`,
        assemblyNames: [assemblyName],
        type: 'FeatureTrack' as const,
      }
      session.addTrackConf(
        mode === 'pattern'
          ? {
              ...shared,
              name: `Sequence search ${value}`,
              adapter: {
                type: 'SequenceSearchAdapter',
                search: value,
                searchForward,
                searchReverse,
                caseInsensitive,
                sequenceAdapter,
              },
            }
          : {
              ...shared,
              name: `CRISPR guides ${pam}`,
              adapter: {
                type: 'CrisprGuideAdapter',
                pam,
                guideLength,
                pamLocation,
                cutOffset,
                searchForward,
                searchReverse,
                sequenceAdapter,
              },
            },
      )
      model.showTrack(shared.trackId)
    }
    handleClose()
  }

  return (
    <Dialog maxWidth="xl" open onClose={handleClose} title="Sequence search">
      <DialogContent className={classes.dialogContent}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={mode}
          onChange={(_event, value) => {
            if (value) {
              setMode(value === 'crispr' ? 'crispr' : 'pattern')
            }
          }}
        >
          <ToggleButton value="pattern">Sequence pattern</ToggleButton>
          <ToggleButton value="crispr">CRISPR guide RNAs</ToggleButton>
        </ToggleButtonGroup>

        {mode === 'pattern' ? (
          <TextField
            size="small"
            value={value}
            onChange={e => {
              setValue(e.target.value)
            }}
            label="Sequence pattern"
            placeholder="e.g. AACT(C|T)"
            error={!!patternError}
            helperText={
              patternError ? `${patternError}` : 'Plain sequence or a regex'
            }
          />
        ) : (
          <>
            <TextField
              select
              size="small"
              label="Enzyme"
              value={enzyme}
              helperText={presetSummary}
              onChange={event => {
                applyPreset(event.target.value)
              }}
            >
              {[...Object.keys(ENZYME_PRESETS), 'Custom'].map(name => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
            {enzyme === 'Custom' ? (
              <>
                <TextField
                  size="small"
                  label="PAM (IUPAC)"
                  value={pam}
                  onChange={event => {
                    setPam(event.target.value.toUpperCase())
                  }}
                />
                <div className={classes.row}>
                  <TextField
                    size="small"
                    label="Guide length (bp)"
                    value={guideLengthStr}
                    error={!(Number.isFinite(guideLength) && guideLength > 0)}
                    onChange={event => {
                      setGuideLengthStr(event.target.value)
                    }}
                  />
                  <TextField
                    size="small"
                    label="Cut offset (bp)"
                    value={cutOffsetStr}
                    error={!Number.isFinite(cutOffset)}
                    onChange={event => {
                      setCutOffsetStr(event.target.value)
                    }}
                  />
                </div>
                <div className={classes.toggleRow}>
                  <Typography variant="body2" color="textSecondary">
                    PAM location
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={pamLocation}
                    onChange={(_event, value) => {
                      if (value) {
                        setPamLocation(value)
                      }
                    }}
                  >
                    <ToggleButton value="3prime">3′ (Cas9)</ToggleButton>
                    <ToggleButton value="5prime">5′ (Cas12a)</ToggleButton>
                  </ToggleButtonGroup>
                </div>
              </>
            ) : null}
          </>
        )}

        <FormGroup row>
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={searchForward}
                onChange={event => {
                  setSearchForward(event.target.checked)
                }}
              />
            }
            label="Forward strand"
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={searchReverse}
                onChange={event => {
                  setSearchReverse(event.target.checked)
                }}
              />
            }
            label="Reverse strand"
          />
          {mode === 'pattern' ? (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={caseInsensitive}
                  onChange={event => {
                    setCaseInsensitive(event.target.checked)
                  }}
                />
              }
              label="Case insensitive"
            />
          ) : null}
        </FormGroup>
        {bothStrandsOff ? (
          <Typography color="error" variant="body2">
            Select at least one strand
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            handleSubmit()
          }}
          disabled={!canSubmit}
          variant="contained"
          color="primary"
        >
          Submit
        </Button>

        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="secondary"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default SequenceSearchDialog
