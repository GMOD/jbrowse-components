import { isJexl } from '@jbrowse/core/util/jexlStrings'
import { MenuItem, TextField } from '@mui/material'

import { DEFAULT_SCORE_COLUMN, SCORE_TRANSFORMS } from './configSchema.ts'

import type { ScoreTransform } from './configSchema.ts'

// UI labels for each native preset. Keyed by the enum so adding a mode to
// SCORE_TRANSFORMS is a compile error here until it's given a label.
const TRANSFORM_LABELS: Record<ScoreTransform, string> = {
  none: 'None — column is already -log10(p)',
  negLog10: '-log10 — column is a raw p-value',
  negLog10FromLn: '-log10 from ln — column is a natural-log p-value',
}

const CUSTOM = 'custom'
// Starter expression when switching into custom mode — identity on the column
// value, so the plot is unchanged until the user edits it.
const CUSTOM_STARTER = 'jexl:score'

// Score-column + transform inputs shared by both GWAS add-track entry points
// (the dedicated workflow and the generic adapter-selected component), so the
// label, default column, and transform options can't drift between them. A
// custom `jexl:` expression is an escape hatch for columns the native presets
// don't cover.
export default function ScoreColumnFields({
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
  const custom = isJexl(scoreTransform)
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
        {SCORE_TRANSFORMS.map(t => (
          <MenuItem key={t} value={t}>
            {TRANSFORM_LABELS[t]}
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
}
