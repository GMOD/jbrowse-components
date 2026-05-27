import { Slider } from '@mui/material'

import type { SliderProps } from '@mui/material'

// MUI's Slider is multi-thumb-capable, so its `onChange`/`onChangeCommitted`
// value parameter is `number | number[]`. Every callsite in this codebase is
// single-thumb, so callers were doing `typeof v === 'number' ? v : v[0]` ad
// hoc. This wrapper narrows the API to `number` once, in one place.
type Props = Omit<
  SliderProps,
  'value' | 'defaultValue' | 'onChange' | 'onChangeCommitted'
> & {
  value: number
  onChange?: (value: number) => void
  onChangeCommitted?: (value: number) => void
}

export default function SingleSlider(props: Props) {
  const { onChange, onChangeCommitted, ...rest } = props
  return (
    <Slider
      {...rest}
      onChange={(_, value) => {
        onChange?.(typeof value === 'number' ? value : value[0])
      }}
      onChangeCommitted={(_, value) => {
        onChangeCommitted?.(typeof value === 'number' ? value : value[0])
      }}
    />
  )
}
