import { useState } from 'react'

import { SingleSlider } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'

import SliderTooltip from './SliderTooltip.tsx'

// Log2-scaled slider for minimum alignment length in bp. Drag state is held
// locally; the model is only updated on commit so dragging doesn't refetch.
export default function MinLengthSlider({
  value,
  onCommit,
  maxBp = 1_000_000,
}: {
  value: number
  onCommit: (bp: number) => void
  maxBp?: number
}) {
  const [dragValue, setDragValue] = useState<number | null>(null)
  const sliderValue = dragValue ?? Math.log2(Math.max(1, value)) * 100
  return (
    <SingleSlider
      value={sliderValue}
      onChange={v => {
        setDragValue(v)
      }}
      onChangeCommitted={() => {
        setDragValue(null)
        onCommit(Math.round(2 ** (sliderValue / 100)))
      }}
      min={0}
      max={Math.log2(maxBp) * 100}
      valueLabelDisplay="auto"
      valueLabelFormat={v => toLocale(Math.round(2 ** (v / 100)))}
      size="small"
      slots={{ valueLabel: SliderTooltip }}
    />
  )
}
