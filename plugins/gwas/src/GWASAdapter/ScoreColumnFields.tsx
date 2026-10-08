import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { DEFAULT_SCORE_COLUMN } from './configSchema.ts'
import { SCORE_TRANSFORMS } from './scoreTransforms.ts'

const CUSTOM = 'custom'
const CUSTOM_STARTER = 'jexl:score'

const ScoreColumnFields = observer(function ScoreColumnFields({
  scoreColumn,
  setScoreColumn,
  scoreTransform,
  setScoreTransform,
}: {
  scoreColumn: string
  setScoreColumn: (val: string) => void
  scoreTransform: string
  setScoreTransform: (val: string) => void
}) {
  const custom = !SCORE_TRANSFORMS.has(scoreTransform)
  return (
    <>
      <TextField
        label="Score column"
        helperText={`BED column to read as the Manhattan score (e.g. '${DEFAULT_SCORE_COLUMN}' for an already -log10 column, or a raw/ln p-value column paired with the transform below)`}
        value={scoreColumn}
        onChange={e => {
          setScoreColumn(e.target.value)
        }}
        fullWidth
      />
      <TextField
        select
        label="Score transform"
        helperText="How to map the score column onto the Manhattan -log10(p) axis"
        value={custom ? CUSTOM : scoreTransform}
        onChange={e => {
          setScoreTransform(
            e.target.value === CUSTOM ? CUSTOM_STARTER : e.target.value,
          )
        }}
        fullWidth
      >
        {[...SCORE_TRANSFORMS].map(([mode, { label }]) => (
          <MenuItem key={mode} value={mode}>
            {label}
          </MenuItem>
        ))}
        <MenuItem value={CUSTOM}>Custom jexl expression…</MenuItem>
      </TextField>
      {custom ? (
        <TextField
          label="Score transform expression"
          helperText="jexl expression of `score`, e.g. jexl:-log10(score)"
          value={scoreTransform}
          onChange={e => {
            setScoreTransform(e.target.value)
          }}
          fullWidth
        />
      ) : null}
    </>
  )
})

export default ScoreColumnFields
