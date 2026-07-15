import { useState } from 'react'

import { SingleSlider, sliderScale } from '@jbrowse/core/ui'
import { toLocale } from '@jbrowse/core/util'

const { toSlider, fromSlider, sliderStep } = sliderScale('log')

// Log2-scaled slider for minimum alignment length in bp. Drag state is held
// locally in slider space; the model is only updated on commit so dragging
// doesn't refetch.
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
  const sliderValue = dragValue ?? toSlider(value)
  return (
    <SingleSlider
      value={sliderValue}
      onChange={v => {
        setDragValue(v)
      }}
      onChangeCommitted={v => {
        setDragValue(null)
        onCommit(fromSlider(v))
      }}
      min={0}
      max={toSlider(maxBp)}
      step={sliderStep}
      valueLabelDisplay="auto"
      valueLabelFormat={v => toLocale(fromSlider(v))}
      size="small"
    />
  )
}
