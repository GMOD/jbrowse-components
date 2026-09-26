import { useState } from 'react'

import { MonospaceTextField, SubmitDialog } from '@jbrowse/core/ui'
import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'
import { DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import {
  channelSpecChanges,
  colorSpecProblems,
  parseChannelSpec,
} from './channelSpec.ts'

import type { ChannelSpec } from './channelSpec.ts'

export interface ChannelSpecHost {
  channelSpec: ChannelSpec
  channelSpecExamples: { spec: string; description: string }[]
  channelSpecProblems: (spec: ChannelSpec) => string[]
  /** The display's own `color.scale` enum, minus `none`, which the string form is. */
  colorScaleChoices: string[]
  /** The members the display's colour object declares. */
  colorMembers: string[]
  applyDisplaySettings: (settings: Record<string, unknown>) => unknown
  /** Absent on a display with no runtime filter list, which then refuses one. */
  setJexlFilters?: (filters?: string[]) => void
  /**
   * On a display with rows: the field and the order, written the way its own
   * reorder writes them, so the labels, the focus and a tree the order still
   * describes survive the box.
   */
  setRowsSpec?: (rows: ChannelSpec['rows']) => void
}

// `facet` and `rows` each exist on the displays whose settings they are, so a
// spec naming one the display lacks is refused here rather than reported as
// an unapplied setting after the write.
function keyedChannelProblems(spec: ChannelSpec, current: ChannelSpec) {
  return (['facet', 'rows'] as const)
    .filter(channel => spec[channel] !== undefined && !(channel in current))
    .map(channel => `${channel}: this display has no ${channel}`)
}

function readSpec(host: ChannelSpecHost, text: string) {
  try {
    const spec = parseChannelSpec(text)
    const problems = [
      ...keyedChannelProblems(spec, host.channelSpec),
      ...colorSpecProblems(spec, {
        scales: host.colorScaleChoices,
        members: host.colorMembers,
      }),
      ...host.channelSpecProblems(spec),
    ]
    return problems.length
      ? { error: problems.join('; ') }
      : { spec, summary: summarize(spec, host.channelSpec) }
  } catch (error) {
    return { error }
  }
}

function summarize(spec: ChannelSpec, current: ChannelSpec) {
  const { sets, clears } = channelSpecChanges(spec, current)
  const dropsOrder =
    sets.includes('facet') && !spec.facet?.domain && !!current.facet?.domain
  const dropsRowOrder =
    sets.includes('rows') && !spec.rows?.domain && !!current.rows?.domain
  return (
    [
      sets.length ? `Sets ${sets.join(', ')}` : '',
      clears.length ? `Clears ${clears.join(', ')}` : '',
      dropsOrder ? 'The facet names no domain, so its sections sort' : '',
      dropsRowOrder
        ? 'The rows name no domain, so they return to the order they arrived in'
        : '',
    ]
      .filter(Boolean)
      .join('. ') || 'No changes'
  )
}

// Only the channels the box changed are written: a channel object replaces
// its setting whole, so writing `rows` back unchanged would drop the members
// the box does not show. `facet` and `color` land through the same door a
// session spec or an agent uses, `rows` through the display's own reorder, and
// `filter` is the runtime list.
function apply(host: ChannelSpecHost, spec: ChannelSpec) {
  const { sets, clears } = channelSpecChanges(spec, host.channelSpec)
  const changed = new Set([...sets, ...clears])
  const settings = Object.fromEntries(
    (['facet', 'color'] as const)
      .filter(channel => changed.has(channel))
      .map(channel => [channel, spec[channel]]),
  )
  if (Object.keys(settings).length > 0) {
    host.applyDisplaySettings(settings)
  }
  if (changed.has('rows')) {
    host.setRowsSpec?.(spec.rows ?? null)
  }
  if (spec.filter !== undefined) {
    host.setJexlFilters?.(spec.filter?.map(ensureJexlPrefix) ?? [])
  }
}

const CHANNELS = ['facet', 'rows', 'color', 'filter'] as const

function channelProse(
  channel: (typeof CHANNELS)[number],
  colorScaleChoices: string[],
) {
  switch (channel) {
    case 'facet':
      return (
        <>
          <code>facet</code> stacks one section per value of a field, in the
          order its <code>domain</code> lists.{' '}
        </>
      )
    case 'rows':
      return (
        <>
          <code>rows</code> stacks one row per value, in the order its{' '}
          <code>domain</code> lists.{' '}
        </>
      )
    case 'color':
      return (
        <>
          <code>color</code> is a constant, or <code>{'{ "field": … }'}</code>{' '}
          read through one of the scales{' '}
          <code>{colorScaleChoices.join(', ')}</code>.{' '}
        </>
      )
    case 'filter':
      return (
        <>
          <code>filter</code> is the jexl list from Filter by....{' '}
        </>
      )
  }
}

function listed(words: readonly string[]) {
  const text =
    words.length > 1
      ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`
      : (words[0] ?? '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

const ChannelSpecDialog = observer(function ChannelSpecDialog({
  model,
  seed,
  handleClose,
}: {
  model: ChannelSpecHost
  seed?: ChannelSpec
  handleClose: () => void
}) {
  const [text, setText] = useState(() =>
    JSON.stringify({ ...model.channelSpec, ...seed }, null, 2),
  )
  const { spec, summary, error } = readSpec(model, text)
  const channels = CHANNELS.filter(c => c in model.channelSpec)

  return (
    <SubmitDialog
      open
      maxWidth="sm"
      fullWidth
      title={listed(channels)}
      submitText="Apply"
      submitDisabled={!spec}
      onCancel={handleClose}
      onSubmit={() => {
        if (spec) {
          apply(model, spec)
          handleClose()
        }
      }}
    >
      <DialogContentText>
        {channels.map(c => (
          <span key={c}>{channelProse(c, model.colorScaleChoices)}</span>
        ))}
        A channel left out stays as it is, and <code>null</code> clears one.
      </DialogContentText>
      <ul>
        {model.channelSpecExamples.map(({ spec, description }) => (
          <li key={spec}>
            <code>{spec}</code> {description}
          </li>
        ))}
      </ul>
      <MonospaceTextField
        fullWidth
        minRows={8}
        maxRows={24}
        value={text}
        error={error}
        onChange={setText}
        helperText={summary}
        inputTestId="channel-spec-json"
      />
    </SubmitDialog>
  )
})

export default ChannelSpecDialog
