import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  DialogActions,
  DialogContent,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import StrandCheckboxes from './StrandCheckboxes.tsx'
import { addReferenceScanTrack } from './searchModes.ts'

import type { SequenceSearchModeProps } from './searchModes.ts'

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

const DEFAULT_ENZYME = 'SpCas9'
const DEFAULT_PRESET = ENZYME_PRESETS[DEFAULT_ENZYME]!

const CrisprGuidePanel = observer(function CrisprGuidePanel({
  model,
  handleClose,
}: SequenceSearchModeProps) {
  const { classes } = useStyles()
  const [enzyme, setEnzyme] = useState(DEFAULT_ENZYME)
  const [pam, setPam] = useState(DEFAULT_PRESET.pam)
  const [pamLocation, setPamLocation] = useState(DEFAULT_PRESET.pamLocation)
  const [guideLengthStr, setGuideLengthStr] = useState(
    String(DEFAULT_PRESET.guideLength),
  )
  const [cutOffsetStr, setCutOffsetStr] = useState(
    String(DEFAULT_PRESET.cutOffset),
  )
  const [searchForward, setSearchForward] = useState(true)
  const [searchReverse, setSearchReverse] = useState(true)

  const guideLength = Number(guideLengthStr)
  const cutOffset = Number(cutOffsetStr)
  // each PAM position must be a single IUPAC code (one base); other characters
  // would leak into the match regex and break the fixed-length placement
  const pamValid = /^[ACGTRYSWKMBDHVN]+$/.test(pam)
  const canSubmit =
    pamValid &&
    Number.isFinite(guideLength) &&
    guideLength > 0 &&
    Number.isFinite(cutOffset) &&
    (searchForward || searchReverse)

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
    addReferenceScanTrack(model, {
      trackId: `crispr_guides_${Date.now()}`,
      name: `CRISPR guides ${pam}`,
      adapter: {
        type: 'CrisprGuideAdapter',
        pam,
        guideLength,
        pamLocation,
        cutOffset,
        searchForward,
        searchReverse,
      },
    })
    handleClose()
  }

  return (
    <>
      <DialogContent className={classes.dialogContent}>
        <TextField
          select
          variant="outlined"
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
              error={!pamValid}
              helperText={pamValid ? undefined : 'Use IUPAC codes only'}
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
        <StrandCheckboxes
          searchForward={searchForward}
          searchReverse={searchReverse}
          setSearchForward={setSearchForward}
          setSearchReverse={setSearchReverse}
        />
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
    </>
  )
})

export default CrisprGuidePanel
