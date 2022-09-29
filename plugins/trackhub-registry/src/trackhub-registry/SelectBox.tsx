import React from 'react'
import {
  FormControl,
  InputLabel,
  FormHelperText,
  MenuItem,
  Select,
  SelectChangeEvent,
} from '@mui/material'

import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()(theme => ({
  formControl: {
    minWidth: 192,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
}))

function SelectBox({
  selectList,
  selectedItem,
  handleSelect,
  label,
  helpText,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectList: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedItem: any
  label: string
  helpText: string
  handleSelect: (evt: SelectChangeEvent) => void
}) {
  const { classes } = useStyles()
  return (
    <FormControl className={classes.formControl}>
      <InputLabel>{label}</InputLabel>
      <Select value={selectedItem} onChange={handleSelect} label={helpText}>
        {selectList.map(item => {
          let value
          let description
          if (item.name) {
            value = item.name
            description = `${item.name} (${item.synonyms.join(' ')})`
          }
          return (
            <MenuItem key={description || item} value={value || item}>
              {description || item}
            </MenuItem>
          )
        })}
      </Select>

      <FormHelperText>{helpText}</FormHelperText>
    </FormControl>
  )
}

export default SelectBox
