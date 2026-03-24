import { observer } from 'mobx-react'
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material'

import type { GraphGenomeViewModel } from '../model.ts'
import type { ColorScheme } from '../../types.ts'

const ColorSchemeSelect = observer(function ColorSchemeSelect({
  model,
}: {
  model: GraphGenomeViewModel
}) {
  return (
    <FormControl size="small" style={{ minWidth: 100 }}>
      <InputLabel>Color</InputLabel>
      <Select
        value={model.colorScheme}
        label="Color"
        onChange={e => model.setColorScheme(e.target.value as ColorScheme)}
      >
        <MenuItem value="uniform">Uniform</MenuItem>
        <MenuItem value="random">Random</MenuItem>
        <MenuItem value="depth">Depth</MenuItem>
        <MenuItem value="gc-content">GC Content</MenuItem>
        <MenuItem value="grey">Grey</MenuItem>
      </Select>
    </FormControl>
  )
})

export default ColorSchemeSelect
