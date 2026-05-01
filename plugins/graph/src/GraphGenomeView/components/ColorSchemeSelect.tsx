import { FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import type { ColorScheme } from '../../types.ts'
import type { GraphGenomeViewModel } from '../model.ts'

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
        onChange={e => {
          model.setColorScheme(e.target.value as ColorScheme)
        }}
      >
        <MenuItem value="uniform">Uniform</MenuItem>
        <MenuItem value="random">Random</MenuItem>
        <MenuItem value="depth">Depth</MenuItem>
        <MenuItem value="node-length">Node Length</MenuItem>
        <MenuItem value="grey">Grey</MenuItem>
      </Select>
    </FormControl>
  )
})

export default ColorSchemeSelect
