import { makeStyles } from '@jbrowse/core/util/tss-react'
import Search from '@mui/icons-material/Search'
import { InputAdornment, TextField } from '@mui/material'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
    minWidth: 200,
  },
})

export default function SearchField({
  searchQuery,
  onChange,
}: {
  searchQuery: string
  onChange: (value: string) => void
}) {
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
