import { useState } from 'react'

import { SingleSlider } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

// Log2-scaled slider for window/step sizes in bp, which span several orders of
// magnitude. The committed value is in bp; the slider operates in log2 space.
// Commits on release so dragging doesn't refetch on every intermediate pixel.
function LogBpSlider({
  label,
  value,
  onCommit,
  maxBp = 100_000,
}: {
  label: string
  value: number
  onCommit: (bp: number) => void
  maxBp?: number
}) {
  const [dragValue, setDragValue] = useState<number | null>(null)
  const shown = dragValue ?? value
  return (
    <div style={{ width: 250, padding: '0 12px' }}>
      <Typography variant="caption" color="textSecondary">
        {label}: {toLocale(shown)} bp
      </Typography>
      <SingleSlider
        value={Math.log2(Math.max(1, shown)) * 100}
        min={0}
        max={Math.log2(maxBp) * 100}
        size="small"
        valueLabelDisplay="auto"
        valueLabelFormat={v => toLocale(Math.round(2 ** (v / 100)))}
        onChange={v => {
          setDragValue(Math.round(2 ** (v / 100)))
        }}
        onChangeCommitted={v => {
          setDragValue(null)
          onCommit(Math.round(2 ** (v / 100)))
        }}
      />
    </div>
  )
}

const GCContentParamsSliders = observer(function GCContentParamsSliders({
  model,
}: {
  model: {
    windowSize: number
    windowDelta: number
    setGCContentParams: (a: { windowSize: number; windowDelta: number }) => void
  }
}) {
  return (
    <>
      <LogBpSlider
        label="Window size"
        value={model.windowSize}
        onCommit={windowSize => {
          model.setGCContentParams({
            windowSize,
            windowDelta: model.windowDelta,
          })
        }}
      />
      <LogBpSlider
        label="Step size"
        value={model.windowDelta}
        maxBp={model.windowSize}
        onCommit={windowDelta => {
          model.setGCContentParams({
            windowSize: model.windowSize,
            windowDelta,
          })
        }}
      />
    </>
  )
})

export default GCContentParamsSliders
