import { MenuItem, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
  },
})

interface CategorySelectorProps {
  allTypes?: { categories: { key: string; title: string; url: string }[] }
  typeOption: string
  allTypesLoading: boolean
  allTypesError?: unknown
  onChange: (value: string) => void
}

export default function CategorySelector({
  allTypes,
  typeOption,
  allTypesLoading,
  allTypesError,
  onChange,
}: CategorySelectorProps) {
  const { classes } = useStyles()

  if (!allTypes) {
    return null
  }

  return (
    <TextField
      select
      name="typeOption"
      label="Group"
      variant="outlined"
      className={classes.root}
      value={typeOption}
      disabled={allTypesLoading}
      onChange={event => {
        onChange(event.target.value)
      }}
      helperText={
        allTypesLoading
          ? 'Loading categories...'
          : allTypesError
            ? 'Using cached categories'
            : ''
      }
    >
      {allTypes.categories.map(({ key, title }) => (
        <MenuItem key={key} value={key}>
          {title}
        </MenuItem>
      ))}
    </TextField>
  )
}