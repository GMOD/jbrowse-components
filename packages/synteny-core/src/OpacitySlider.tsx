import { SingleSlider, sliderScale } from '@jbrowse/core/ui'

const { toSlider, fromSlider, sliderStep } = sliderScale('cubic')

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
      value={toSlider(value)}
      onChange={v => {
        onChange(fromSlider(v))
      }}
      min={0}
      max={1}
      step={sliderStep}
      valueLabelDisplay="auto"
      size="small"
      valueLabelFormat={(v: number) => fromSlider(v).toFixed(3)}
    />
  )
}
