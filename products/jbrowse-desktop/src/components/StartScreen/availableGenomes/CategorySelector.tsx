import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { Category } from './useCategories.ts'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
  },
})

// Rendered only once categories.json has resolved: useFetch clears data while
// loading and on error, so there is no state where this has a list to show but
// is also still loading or failed. A search covers every group, so while one
// runs the selector says so and stands aside.
const CategorySelector = observer(function CategorySelector({
  categories,
  typeOption,
  searching,
  onChange,
}: {
  categories: Category[]
  typeOption: string
  searching: boolean
  onChange: (value: string) => void
}) {
  const { classes } = useStyles()

  return (
    <TextField
      select
      name="typeOption"
      label="Group"
      variant="outlined"
      className={classes.root}
      value={searching ? 'allGroups' : typeOption}
      disabled={searching}
      onChange={event => {
        onChange(event.target.value)
      }}
    >
      {searching ? (
        <MenuItem value="allGroups">All groups</MenuItem>
      ) : (
        categories.map(({ key, title }) => (
          <MenuItem key={key} value={key}>
            {title}
          </MenuItem>
        ))
      )}
    </TextField>
  )
})

export default CategorySelector
