import { QuickStartPanel, dotplotAxesFromRows } from '@jbrowse/synteny-core'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// A dotplot is one pair, so only the track's first two assemblies are used; an
// all-vs-all track's extra assemblies are called out rather than silently
// dropped. Track assemblyNames are ordered [assembly1, assembly2] = [Y, X], but
// a synteny track is queryable in either direction, so which assembly lands on
// which axis is the user's choice, not a fact about the track — hence Swap.
const QuickStart = observer(function QuickStart({
  model,
  tracks,
  trackId,
  rows,
  submitting,
  onChange,
  onLaunch,
  onSwap,
}: {
  model: DotplotViewModel
  tracks: AnyConfigurationModel[]
  trackId: string
  rows: string[]
  submitting: boolean
  onChange: (trackId: string) => void
  onLaunch: () => void
  onSwap: () => void
}) {
  const axes = dotplotAxesFromRows(rows)
  return (
    <QuickStartPanel
      model={model}
      tracks={tracks}
      trackId={trackId}
      submitting={submitting}
      onChange={onChange}
      onLaunch={onLaunch}
      onSwap={onSwap}
      swapTitle="Put each assembly on the other axis (transposes the plot)"
    >
      <div data-testid="quick-start-axes">
        <Typography variant="body2">X-axis: {axes.x}</Typography>
        <Typography variant="body2">Y-axis: {axes.y}</Typography>
        {rows.length > 2 ? (
          <Typography variant="body2" color="text.secondary">
            This track spans {rows.length} assemblies; a dotplot shows one pair,
            so the other {rows.length - 2} are not used. Switch to Manual to plot
            a different pair.
          </Typography>
        ) : null}
      </div>
    </QuickStartPanel>
  )
})

export default QuickStart
