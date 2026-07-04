import { useState } from 'react'

import { SingleSlider } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

// Commits on release (onChangeCommitted) rather than live: the threshold flows
// through rpcProps into the worker's extractModifications (tier-1 refetch), so a
// live onChange would fire a worker refetch on every intermediate pixel. The
// thumb tracks a local value mid-drag.
export function ModificationThresholdSlider({
  initialValue,
  onCommit,
}: {
  initialValue: number
  onCommit: (value: number) => void
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <div style={{ width: 200 }}>
      <Typography variant="caption" color="textSecondary">
        Threshold: {value}%
      </Typography>
      <SingleSlider
        value={value}
        min={0}
        max={100}
        step={1}
        size="small"
        valueLabelDisplay="auto"
        valueLabelFormat={(v: number) => `${v}%`}
        onChange={v => {
          setValue(v)
        }}
        onChangeCommitted={v => {
          onCommit(v)
        }}
      />
    </div>
  )
}
