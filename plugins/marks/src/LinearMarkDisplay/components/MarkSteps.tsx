import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteIcon from '@mui/icons-material/Delete'
import { IconButton, TextField, Typography } from '@mui/material'

import {
  AGGREGATE_OPS,
  STEP_PRESETS,
  stepSummary,
  withAggregateOp,
  withStepSlot,
} from '../plotEdit.ts'
import { MarkSlotProblems } from './MarkProblems.tsx'

import type { MarkProblemIndex } from '../markProblemIndex.ts'
import type { StepSnapshot } from '../markProblems.ts'
import type { AggregateOpName } from '../markVocabulary.ts'

// The slots a step's row edits in place, by type: the expression a filter or
// formula runs, the width a bin takes, what a coverage or pileup writes. An
// aggregate's first op and its field have a row of their own below.
const STEP_SLOTS: Partial<Record<StepSnapshot['type'], readonly string[]>> = {
  filter: ['expr'],
  formula: ['expr', 'as'],
  bin: ['step'],
  coverage: ['as'],
  pileup: ['padding'],
  flatten: ['field'],
}

function slotText(step: StepSnapshot, slot: string) {
  const held = (step as Record<string, unknown>)[slot]
  return held === undefined ? '' : String(held)
}

function StepRow({
  step,
  onChange,
}: {
  step: StepSnapshot
  onChange: (step: StepSnapshot) => void
}) {
  const op =
    step.type === 'aggregate' ? (step.ops?.[0] ?? { op: 'count' }) : undefined
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(STEP_SLOTS[step.type] ?? []).map(slot => (
        <TextField
          key={slot}
          size="small"
          label={slot === 'step' ? 'bin width (bp or auto)' : slot}
          value={slotText(step, slot)}
          onChange={event => {
            onChange(withStepSlot(step, slot, event.target.value))
          }}
          slotProps={{
            htmlInput: { 'data-testid': `step-${step.type}-${slot}` },
          }}
        />
      ))}
      {op ? (
        <>
          <TextField
            select
            size="small"
            label="summary"
            value={op.op ?? 'count'}
            onChange={event => {
              onChange(
                withAggregateOp(
                  step,
                  event.target.value as AggregateOpName,
                  op.field ?? '',
                ),
              )
            }}
            slotProps={{
              select: { native: true },
              htmlInput: { 'data-testid': 'step-aggregate-op' },
            }}
          >
            {AGGREGATE_OPS.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </TextField>
          {op.op && op.op !== 'count' ? (
            <TextField
              size="small"
              label="of field"
              value={op.field ?? ''}
              onChange={event => {
                onChange(withAggregateOp(step, op.op!, event.target.value))
              }}
              slotProps={{
                htmlInput: { 'data-testid': 'step-aggregate-field' },
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/**
 * A mark's steps, in the order they run over the features before it encodes
 * them: each one named by what it writes, its settings in place, moved or
 * removed from its row, and a new one added from a list of the common forms.
 * A step writing a `y` fills a mark that names none (ADR-173), which is why
 * adding a count or a coverage is often the whole edit.
 */
export default function MarkSteps({
  steps,
  at,
  problems,
  onChange,
}: {
  steps: readonly StepSnapshot[]
  at: number
  problems: MarkProblemIndex
  onChange: (steps: StepSnapshot[]) => void
}) {
  return (
    <div data-testid="mark-steps">
      <Typography variant="subtitle2">Steps before this mark</Typography>
      {steps.map((step, i) => (
        // eslint-disable-next-line @eslint-react/no-array-index-key -- a step has no identity but its place, which is its run order
        <div key={i} data-testid={`mark-step-${i}`}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ flex: 1 }}>{stepSummary(step)}</span>
            <IconButton
              aria-label={`move step ${i + 1} up`}
              disabled={i === 0}
              onClick={() => {
                onChange(steps.toSpliced(i - 1, 2, steps[i]!, steps[i - 1]!))
              }}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={`move step ${i + 1} down`}
              disabled={i === steps.length - 1}
              onClick={() => {
                onChange(steps.toSpliced(i, 2, steps[i + 1]!, steps[i]!))
              }}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              aria-label={`remove step ${i + 1}`}
              onClick={() => {
                onChange(steps.toSpliced(i, 1))
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </div>
          <StepRow
            step={step}
            onChange={next => {
              onChange(steps.with(i, next))
            }}
          />
          <MarkSlotProblems problems={problems.under(at, `transform.${i}`)} />
        </div>
      ))}
      <TextField
        select
        size="small"
        label="Add a step"
        value=""
        onChange={event => {
          const preset = STEP_PRESETS[Number(event.target.value)]
          if (preset) {
            onChange([...steps, ...structuredClone(preset.steps)])
          }
        }}
        slotProps={{
          select: { native: true },
          htmlInput: { 'data-testid': 'add-step' },
        }}
      >
        <option value="" />
        {STEP_PRESETS.map((preset, i) => (
          <option key={preset.label} value={i}>
            {preset.label}
          </option>
        ))}
      </TextField>
    </div>
  )
}
