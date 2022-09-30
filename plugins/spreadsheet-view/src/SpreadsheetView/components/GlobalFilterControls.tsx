import React, { useState, useEffect } from 'react'

import { IconButton, InputAdornment, TextField } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import FilterIcon from '@mui/icons-material/FilterList'

import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { useDebounce } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  textFilterControlEndAdornment: {
    marginRight: '-18px',
  },
})

const TextFilter = observer(
  ({
    textFilter,
  }: {
    textFilter: { stringToFind: string; setString: (arg: string) => void }
  }) => {
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
      <div>
        <TextField
          label="text filter"
          value={textFilterValue}
          onChange={evt => setTextFilterValue(evt.target.value)}
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
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
  },
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GlobalFilterControls = observer(({ model }: { model: any }) => {
  const textFilter = model.filterControls.rowFullText
  return <TextFilter textFilter={textFilter} />
})

export default GlobalFilterControls
