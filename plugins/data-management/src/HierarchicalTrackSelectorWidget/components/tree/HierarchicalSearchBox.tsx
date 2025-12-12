import { makeStyles } from '@jbrowse/core/util/tss-react'
import ClearIcon from '@mui/icons-material/Clear'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { HierarchicalTrackSelectorModel } from '../../model'

const useStyles = makeStyles()(theme => ({
  searchBox: {
    margin: theme.spacing(2),
  },
}))

const HierarchicalSearchBox = observer(function ({
  model,
}: {
  model: HierarchicalTrackSelectorModel
}) {
  const { filterText } = model
  const { classes } = useStyles()
  return (
    <TextField
      className={classes.searchBox}
      label="Filter tracks"
      value={filterText}
      onChange={event => {
        model.setFilterText(event.target.value)
      }}
      fullWidth
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => {
                  model.clearFilterText()
                }}
              >
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
})

export default HierarchicalSearchBox
