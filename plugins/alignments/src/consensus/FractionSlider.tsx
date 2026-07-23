import { useState } from 'react'

import { SingleSlider } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

// 0-1 threshold slider for the consensus dialog. Drag state is held locally and
// the value is only committed on release, because the committed value is part
// of the dialog's useFetch key — a continuous onChange would fire one worker
// recompute per drag step. Same reason as MinLengthSlider.
//
// The number stays visible rather than living only in the drag tooltip, so a
// consensus can be reproduced from what the dialog was showing.
export default function FractionSlider({
  label,
  helpText,
  value,
  onCommit,
}: {
  label: string
  helpText: string
  value: number
  onCommit: (value: number) => void
}) {
  const [dragValue, setDragValue] = useState<number | null>(null)
  const displayed = dragValue ?? value
  return (
    <div style={{ width: 210 }}>
      <Typography variant="caption" component="div">
        {label}: {displayed.toFixed(2)}
      </Typography>
      <SingleSlider
        value={displayed}
        onChange={v => {
          setDragValue(v)
        }}
        onChangeCommitted={v => {
          setDragValue(null)
          onCommit(v)
        }}
        min={0}
        max={1}
        step={0.05}
        valueLabelDisplay="auto"
        size="small"
      />
      <Typography variant="caption" color="text.secondary" component="div">
        {helpText}
      </Typography>
    </div>
  )
}
