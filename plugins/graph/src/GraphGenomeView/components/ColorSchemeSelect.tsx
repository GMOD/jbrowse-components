import { FormControl, InputLabel, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { GraphGenomeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  formControl: {
    minWidth: 100,
  },
})

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
        <MenuItem value="uniform">Uniform</MenuItem>
        <MenuItem value="random">Random</MenuItem>
        <MenuItem value="rainbow">Rainbow</MenuItem>
        <MenuItem value="depth">Depth</MenuItem>
        <MenuItem value="node-length">Node Length</MenuItem>
        <MenuItem value="grey">Grey</MenuItem>
      </Select>
    </FormControl>
  )
})

export default ColorSchemeSelect
