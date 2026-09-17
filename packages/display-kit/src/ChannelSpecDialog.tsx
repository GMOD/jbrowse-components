import { useState } from 'react'

import { MonospaceTextField, SubmitDialog } from '@jbrowse/core/ui'
import { DialogContentText, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { channelSpecChanges, parseChannelSpec } from './channelSpec.ts'

import type { ChannelSpec } from './channelSpec.ts'

export interface ChannelSpecHost {
  channelSpec: ChannelSpec
  channelSpecProblems: (spec: ChannelSpec) => string[]
  applyChannelSpec: (spec: ChannelSpec) => void
}

function readSpec(host: ChannelSpecHost, text: string) {
  try {
    const spec = parseChannelSpec(text)
    const problems = host.channelSpecProblems(spec)
    return problems.length
      ? { error: problems.join('\n') }
      : { spec, changes: channelSpecChanges(spec, host.channelSpec) }
  } catch (error) {
    return { error }
  }
}

const ChannelSpecDialog = observer(function ChannelSpecDialog({
  model,
  handleClose,
}: {
  model: ChannelSpecHost
  handleClose: () => void
}) {
  const [text, setText] = useState(() =>
    JSON.stringify(model.channelSpec, null, 2),
  )
  const { spec, changes, error } = readSpec(model, text)
  const summary = changes
    ? [
        changes.sets.length ? `Sets ${changes.sets.join(', ')}` : '',
        changes.clears.length ? `Clears ${changes.clears.join(', ')}` : '',
      ].filter(Boolean)
    : []

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
          model.applyChannelSpec(spec)
          handleClose()
        }
      }}
    >
      <DialogContentText>
        <code>facet</code> stacks one section per value of a field, in the order
        its <code>domain</code> lists; <code>color</code> paints by a field or a
        constant <code>value</code>; <code>filter</code> keeps what its jexl
        expressions pass. A channel left out stays as it is, and{' '}
        <code>null</code> clears one.
      </DialogContentText>
      <MonospaceTextField
        fullWidth
        minRows={8}
        maxRows={24}
        value={text}
        error={error}
        onChange={setText}
      />
      {summary.map(line => (
        <Typography key={line} variant="body2">
          {line}
        </Typography>
      ))}
    </SubmitDialog>
  )
})

export default ChannelSpecDialog
