import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, FormControlLabel, TextField } from '@mui/material'

import FractionSlider from './FractionSlider.tsx'
import SettingLabel from './SettingLabel.tsx'

import type { ConsensusSettings } from './useConsensusSettings.ts'

const useStyles = makeStyles()(theme => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: 'max-content 1fr',
    alignItems: 'center',
    columnGap: theme.spacing(2),
    rowGap: theme.spacing(1),
    width: 'max-content',
    margin: theme.spacing(1, 0),
  },
  checkbox: {
    gridColumn: '1 / -1',
  },
  number: {
    width: 80,
  },
}))

export default function ConsensusSettingsPanel({
  settings,
}: {
  settings: ConsensusSettings
}) {
  const { classes } = useStyles()
  const {
    minDepth,
    setMinDepth,
    callFract,
    setCallFract,
    ambiguityCodes,
    setAmbiguityCodes,
    hetFract,
    setHetFract,
    includeInsertions,
    setIncludeInsertions,
    excludeSecondary,
    setExcludeSecondary,
  } = settings
  return (
    <div className={classes.grid}>
      <SettingLabel
        label="Min read depth"
        help="positions covered by fewer reads than this are called N, however well the reads agree"
      />
      <TextField
        className={classes.number}
        type="number"
        size="small"
        variant="standard"
        value={minDepth}
        slotProps={{ htmlInput: { min: 1, step: 1 } }}
        onChange={event => {
          const v = Number.parseInt(event.target.value, 10)
          setMinDepth(Number.isFinite(v) && v >= 1 ? v : 1)
        }}
      />
      <FractionSlider
        label="Min call fraction"
        help="the called base must account for at least this share of the reads, or the position is N"
        value={callFract}
        onCommit={v => {
          setCallFract(v)
        }}
      />
      <FormControlLabel
        className={classes.checkbox}
        control={
          <Checkbox
            size="small"
            checked={ambiguityCodes}
            onChange={event => {
              setAmbiguityCodes(event.target.checked)
            }}
          />
        }
        label="Report disagreeing positions as IUPAC ambiguity codes"
      />
      {ambiguityCodes ? (
        <FractionSlider
          label="Min het fraction"
          help="an allele joins the call when its support is at least this share of the top base's; lower gives more ambiguity codes"
          value={hetFract}
          onCommit={v => {
            setHetFract(v)
          }}
        />
      ) : null}
      <FormControlLabel
        className={classes.checkbox}
        control={
          <Checkbox
            size="small"
            checked={includeInsertions}
            onChange={event => {
              setIncludeInsertions(event.target.checked)
            }}
          />
        }
        label="Include insertions supported by the reads"
      />
      <FormControlLabel
        className={classes.checkbox}
        control={
          <Checkbox
            size="small"
            checked={excludeSecondary}
            onChange={event => {
              setExcludeSecondary(event.target.checked)
            }}
          />
        }
        label="Exclude secondary alignments"
      />
    </div>
  )
}
