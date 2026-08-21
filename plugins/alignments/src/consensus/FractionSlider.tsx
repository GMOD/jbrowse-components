import { useState } from 'react'

import { SingleSlider } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

import SettingLabel from './SettingLabel.tsx'

// A label/control row pair for the settings grid, so it returns a fragment
// rather than a wrapper element.
//
// Drag state is held locally and the value is only committed on release,
// because the committed value is part of the dialog's useFetch key — a
// continuous onChange would fire one worker recompute per drag step. Same
// reason as `makeSizeSubMenu`'s commitOnRelease. The number stays visible
// beside the slider rather
// than living only in the drag tooltip, so a consensus can be reproduced from
// what the dialog was showing.
export default function FractionSlider({
  label,
  help,
  value,
  onCommit,
}: {
  label: string
  help: string
  value: number
  onCommit: (value: number) => void
}) {
  const [dragValue, setDragValue] = useState<number | null>(null)
  const displayed = dragValue ?? value
  return (
    <>
      <SettingLabel label={label} help={help} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <SingleSlider
          style={{ width: 180 }}
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
          size="small"
        />
        <Typography variant="body2">{displayed.toFixed(2)}</Typography>
      </div>
    </>
  )
}
