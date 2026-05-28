import { SingleSlider } from '@jbrowse/core/ui'

import SliderTooltip from './SliderTooltip.tsx'

// Cubic scaling gives finer control near 0 where small opacity changes are
// perceptually large.
export default function OpacitySlider({
  value,
  onChange,
}: {
  value: number
  onChange: (alpha: number) => void
}) {
  return (
    <SingleSlider
      value={Math.cbrt(value)}
      onChange={v => {
        onChange(v ** 3)
      }}
      min={0}
      max={1}
      step={0.01}
      valueLabelDisplay="auto"
      size="small"
      slots={{ valueLabel: SliderTooltip }}
      valueLabelFormat={(v: number) => (v ** 3).toFixed(3)}
    />
  )
}
