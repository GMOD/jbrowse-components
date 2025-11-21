import Search from '@mui/icons-material/Search'
import { InputAdornment, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
  },
})

interface SearchFieldProps {
  searchQuery: string
  onChange: (value: string) => void
}

export default function SearchField({
  searchQuery,
  onChange,
}: SearchFieldProps) {
  const { classes } = useStyles()

  return (
    <TextField
      type="text"
      placeholder="Search genomes..."
      value={searchQuery}
      onChange={e => {
        onChange(e.target.value)
      }}
      variant="outlined"
      size="small"
      className={classes.root}
      style={{ minWidth: 200 }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
