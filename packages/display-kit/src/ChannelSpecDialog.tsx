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
  applyDisplaySettings: (settings: Record<string, unknown>) => unknown
  /** Absent on a display with no runtime filter list, which then refuses one. */
  setJexlFilters?: (filters?: string[]) => void
}

function readSpec(host: ChannelSpecHost, text: string) {
  try {
    const spec = parseChannelSpec(text)
    const problems = [
      ...colorSpecProblems(spec, host.colorScaleChoices),
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
  return (
    [
      sets.length ? `Sets ${sets.join(', ')}` : '',
      clears.length ? `Clears ${clears.join(', ')}` : '',
      dropsOrder ? 'The facet names no domain, so its sections sort' : '',
    ]
      .filter(Boolean)
      .join('. ') || 'No changes'
  )
}

// `facet` and `color` are the display's own settings and land through the
// same door a session spec or an agent uses; `filter` is the runtime list.
function apply(host: ChannelSpecHost, spec: ChannelSpec) {
  const { filter, ...settings } = spec
  if (Object.keys(settings).length > 0) {
    host.applyDisplaySettings(settings)
  }
  if (filter !== undefined) {
    host.setJexlFilters?.(filter?.map(ensureJexlPrefix) ?? [])
  }
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

  return (
    <SubmitDialog
      open
      maxWidth="sm"
      fullWidth
      title="Facet, color and filter"
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
        <code>facet</code> stacks one section per value of a field, in the order
        its <code>domain</code> lists; <code>color</code> is a constant, or{' '}
        <code>{'{ "field": … }'}</code> read through one of the scales{' '}
        <code>{model.colorScaleChoices.join(', ')}</code>; <code>filter</code>{' '}
        is the jexl list from Filter by.... A channel left out stays as it is,
        and <code>null</code> clears one.
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
