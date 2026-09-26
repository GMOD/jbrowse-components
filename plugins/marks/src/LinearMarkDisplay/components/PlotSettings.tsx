import { useState } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import { Autocomplete, TextField, Typography } from '@mui/material'

import {
  axisMember,
  splitField,
  splitOrder,
  withAxisMember,
  withSplitField,
  withSplitOrder,
} from '../plotEdit.ts'
import { MarkSlotProblems } from './MarkProblems.tsx'

import type { MarkPlot } from '../markPlot.ts'
import type { MarkProblemIndex } from '../markProblemIndex.ts'
import type { AxisMember } from '../plotEdit.ts'

const AXIS_TYPES = ['linear', 'log', 'symlog'] as const

const SPLIT_LABELS = {
  facet: 'Sections by field',
  rows: 'One row per value of',
} as const

function SplitControls({
  plot,
  kind,
  options,
  problems,
  onChange,
}: {
  plot: MarkPlot
  kind: 'facet' | 'rows'
  options: readonly string[]
  problems: MarkProblemIndex
  onChange: (plot: MarkPlot) => void
}) {
  const [order, setOrder] = useState(() => splitOrder(plot, kind))
  const field = splitField(plot, kind)
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Autocomplete
        freeSolo
        style={{ flex: 1 }}
        options={[...options]}
        inputValue={field}
        onInputChange={(_event, next) => {
          onChange(withSplitField(plot, kind, next))
        }}
        renderInput={({ slotProps, ...params }) => (
          <TextField
            {...params}
            label={SPLIT_LABELS[kind]}
            slotProps={{
              ...slotProps,
              htmlInput: {
                ...slotProps.htmlInput,
                'data-testid': `${kind}-field`,
              },
            }}
          />
        )}
      />
      {field ? (
        <TextField
          style={{ flex: 1 }}
          label="order (values first, comma-separated)"
          value={order}
          onChange={event => {
            setOrder(event.target.value)
            onChange(withSplitOrder(plot, kind, event.target.value))
          }}
          slotProps={{ htmlInput: { 'data-testid': `${kind}-order` } }}
        />
      ) : null}
      <MarkSlotProblems problems={problems.under(undefined, kind)} />
    </div>
  )
}

function AxisField({
  plot,
  member,
  label,
  type = 'text',
  onChange,
}: {
  plot: MarkPlot
  member: AxisMember
  label: string
  type?: 'text' | 'number'
  onChange: (plot: MarkPlot) => void
}) {
  return (
    <TextField
      type={type}
      label={label}
      value={axisMember(plot, member)}
      onChange={event => {
        onChange(withAxisMember(plot, member, event.target.value))
      }}
      slotProps={{ htmlInput: { 'data-testid': `axis-${member}` } }}
    />
  )
}

/**
 * What the plot does as a whole, beside its marks: the sections it stacks by
 * a field (`facet`), the one row per value of a field (`rows`), each with the
 * order its values take, and the y axis every mark stands on — its caption,
 * its type, pinned ends where a figure wants them fixed, and a line at each
 * tick.
 */
export default function PlotSettings({
  plot,
  options,
  problems,
  onChange,
}: {
  plot: MarkPlot
  options: readonly string[]
  problems: MarkProblemIndex
  onChange: (plot: MarkPlot) => void
}) {
  return (
    <div data-testid="plot-settings">
      <Typography variant="subtitle2">Plot</Typography>
      <SplitControls
        plot={plot}
        kind="facet"
        options={options}
        problems={problems}
        onChange={onChange}
      />
      <SplitControls
        plot={plot}
        kind="rows"
        options={options}
        problems={problems}
        onChange={onChange}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <AxisField
          plot={plot}
          member="title"
          label="axis title"
          onChange={onChange}
        />
        <TextField
          select
          label="axis"
          value={axisMember(plot, 'type') || 'linear'}
          onChange={event => {
            onChange(
              withAxisMember(
                plot,
                'type',
                event.target.value === 'linear' ? '' : event.target.value,
              ),
            )
          }}
          slotProps={{
            select: { native: true },
            htmlInput: { 'data-testid': 'axis-type' },
          }}
        >
          {AXIS_TYPES.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </TextField>
        <AxisField
          plot={plot}
          member="domainMin"
          label="min"
          type="number"
          onChange={onChange}
        />
        <AxisField
          plot={plot}
          member="domainMax"
          label="max"
          type="number"
          onChange={onChange}
        />
        <LabeledCheckbox
          checked={axisMember(plot, 'grid') === 'true'}
          onChange={next => {
            onChange(withAxisMember(plot, 'grid', next ? 'true' : ''))
          }}
          label="grid"
        />
      </div>
    </div>
  )
}
