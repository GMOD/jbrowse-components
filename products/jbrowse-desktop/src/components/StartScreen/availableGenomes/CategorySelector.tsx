import { MenuItem, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
  },
})

interface CategorySelectorProps {
  categories?: { categories: { key: string; title: string; url: string }[] }
  typeOption: string
  categoriesLoading: boolean
  categoriesError?: unknown
  onChange: (value: string) => void
}

export default function CategorySelector({
  categories,
  typeOption,
  categoriesLoading,
  categoriesError,
  onChange,
}: CategorySelectorProps) {
  const { classes } = useStyles()

  if (!categories) {
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
      disabled={categoriesLoading}
      onChange={event => {
        onChange(event.target.value)
      }}
      helperText={
        categoriesLoading
          ? 'Loading categories...'
          : categoriesError
            ? 'Using cached categories'
            : ''
      }
    >
      {categories.categories.map(({ key, title }) => (
        <MenuItem key={key} value={key}>
          {title}
        </MenuItem>
      ))}
    </TextField>
  )
}
