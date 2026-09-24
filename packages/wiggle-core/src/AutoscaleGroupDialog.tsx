import { useState } from 'react'

import { LabeledCheckbox, SubmitDialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { autoscalePeers, autoscaleWith } from './autoscaleGroup.ts'

import type { AutoscalePeer } from './autoscaleGroup.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export default observer(function AutoscaleGroupDialog({
  model,
  handleClose,
}: {
  model: AutoscalePeer & IStateTreeNode
  handleClose: () => void
}) {
  const peers = autoscalePeers(model)
  const group = model.autoscaleGroup
  const [chosen, setChosen] = useState(
    () =>
      new Set<AutoscalePeer>(
        group === undefined
          ? []
          : peers.map(p => p.display).filter(d => d.autoscaleGroup === group),
      ),
  )
  return (
    <SubmitDialog
      open
      title="Autoscale with other tracks"
      submitText="Apply"
      onCancel={handleClose}
      onSubmit={() => {
        autoscaleWith(
          model,
          peers.map(p => p.display),
          chosen,
        )
        handleClose()
      }}
    >
      <Typography color="text.secondary">
        The tracks ticked here share this track&apos;s axis: each end nobody
        pinned spans all of their data, and follows it as the view moves.
      </Typography>
      {peers.map(({ display, key, name }) => (
        <div key={key}>
          <LabeledCheckbox
            checked={chosen.has(display)}
            label={name}
            onChange={checked => {
              const next = new Set(chosen)
              if (checked) {
                next.add(display)
              } else {
                next.delete(display)
              }
              setChosen(next)
            }}
          />
        </div>
      ))}
    </SubmitDialog>
  )
})
