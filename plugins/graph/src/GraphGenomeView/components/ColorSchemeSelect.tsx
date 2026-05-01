import { FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { ColorScheme } from '../../types.ts'
import type { GraphGenomeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  formControl: {
    minWidth: 100,
  },
})

export const COLOR_SCHEME_OPTIONS: { value: ColorScheme; label: string }[] = [
  { value: 'uniform', label: 'Uniform' },
  { value: 'random', label: 'Random' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'depth', label: 'Depth' },
  { value: 'node-length', label: 'Node Length' },
  { value: 'grey', label: 'Grey' },
]

const ColorSchemeSelect = observer(function ColorSchemeSelect({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  const { classes } = useStyles()
  return (
    <FormControl size="small" className={classes.formControl}>
      <InputLabel>Color</InputLabel>
      <Select
        value={model.colorScheme}
        label="Color"
        onChange={e => {
          model.setColorScheme(e.target.value)
        }}
      >
        {COLOR_SCHEME_OPTIONS.map(({ value, label }) => (
          <MenuItem key={value} value={value}>
            {label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
})

export default ColorSchemeSelect
