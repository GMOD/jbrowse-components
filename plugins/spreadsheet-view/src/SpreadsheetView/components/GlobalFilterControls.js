import React, { useState, useEffect } from 'react'

import { IconButton, InputAdornment, TextField } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import FilterIcon from '@mui/icons-material/FilterList'

import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { useDebounce } from '@jbrowse/core/util'

const useStyles = makeStyles()((/* theme */) => {
  return {
    textFilterControlEndAdornment: { marginRight: '-18px' },
  }
})

const TextFilter = observer(({ textFilter }) => {
  const { classes } = useStyles()
  // this paragraph is silliness to debounce the text filter input
  const [textFilterValue, setTextFilterValue] = useState(
    textFilter.stringToFind,
  )
  const debouncedTextFilter = useDebounce(textFilterValue, 500)
  useEffect(() => {
    textFilter.setString(debouncedTextFilter)
  }, [debouncedTextFilter, textFilter])

  return (
    <div className={classes.filterControls}>
      <TextField
        label="text filter"
        value={textFilterValue}
        onChange={evt => setTextFilterValue(evt.target.value)}
        className={classes.textFilterControl}
        variant="outlined"
        InputProps={{
          startAdornment: (
            <InputAdornment
              className={classes.textFilterControlStartAdornment}
              position="start"
            >
              <FilterIcon />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment
              className={classes.textFilterControlEndAdornment}
              position="end"
            >
              <IconButton
                aria-label="clear filter"
                onClick={() => setTextFilterValue('')}
                color="secondary"
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </div>
  )
})

const GlobalFilterControls = observer(({ model }) => {
  // const classes = useStyles()
  const textFilter = model.filterControls.rowFullText
  return <TextFilter textFilter={textFilter} />
})

export default GlobalFilterControls
