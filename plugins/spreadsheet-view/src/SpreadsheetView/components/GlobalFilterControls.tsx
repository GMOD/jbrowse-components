import React, { useState, useEffect } from 'react'

import { useDebounce } from '@jbrowse/core/util'
import ClearIcon from '@mui/icons-material/Clear'
import FilterIcon from '@mui/icons-material/FilterList'
import { IconButton, InputAdornment, TextField } from '@mui/material'

import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  textFilterControlEndAdornment: {
    marginRight: '-18px',
  },
})

const TextFilter = observer(function ({
  textFilter,
}: {
  textFilter: { stringToFind: string; setString: (arg: string) => void }
}) {
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
        onChange={evt => {
          setTextFilterValue(evt.target.value)
        }}
        variant="outlined"
        slotProps={{
          input: {
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
                  onClick={() => {
                    setTextFilterValue('')
                  }}
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    </div>
  )
})

const GlobalFilterControls = observer(({ model }: { model: any }) => {
  const textFilter = model.filterControls.rowFullText
  return <TextFilter textFilter={textFilter} />
})

export default GlobalFilterControls
