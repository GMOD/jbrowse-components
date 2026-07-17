import { QuickStartPanel } from '@jbrowse/synteny-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// The rows the chosen track implies, shown where the picker is rather than
// written into a form elsewhere on the page.
const QuickStart = observer(function QuickStart({
  model,
  tracks,
  trackId,
  rows,
  submitting,
  onChange,
  onLaunch,
}: {
  model: LinearSyntenyViewModel
  tracks: AnyConfigurationModel[]
  trackId: string
  rows: string[]
  submitting: boolean
  onChange: (trackId: string) => void
  onLaunch: () => void
}) {
  return (
    <QuickStartPanel
      model={model}
      tracks={tracks}
      trackId={trackId}
      submitting={submitting}
      onChange={onChange}
      onLaunch={onLaunch}
    >
      {/* inline-block so the block hugs the row list rather than spanning the
      form, which keeps it a meaningful thing to point at */}
      <div data-testid="quick-start-rows" style={{ display: 'inline-block' }}>
        <Typography variant="body2" color="text.secondary">
          Opens {rows.length} rows, top to bottom:
        </Typography>
        {rows.map((row, idx) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- row position is the identity here; assembly names can repeat across rows
          <Typography key={`${row}-${idx}`} variant="body2">
            {idx + 1}. {row}
          </Typography>
        ))}
      </div>
    </QuickStartPanel>
  )
})

export default QuickStart
