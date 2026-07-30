import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MenuItem, TextField } from '@mui/material'

import type { Category } from './useCategories.ts'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
  },
})

// Rendered only once categories.json has resolved: useFetch clears data while
// loading and on error, so there is no state where this has a list to show but
// is also still loading or failed.
export default function CategorySelector({
  categories,
  typeOption,
  onChange,
}: {
  categories: Category[]
  typeOption: string
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
      value={typeOption}
      onChange={event => {
        onChange(event.target.value)
      }}
    >
      {categories.map(({ key, title }) => (
        <MenuItem key={key} value={key}>
          {title}
        </MenuItem>
      ))}
    </TextField>
  )
}
