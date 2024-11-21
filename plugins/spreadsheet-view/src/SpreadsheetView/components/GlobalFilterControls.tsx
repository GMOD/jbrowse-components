import React, { useState, useEffect } from 'react'

import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
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
