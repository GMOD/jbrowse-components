import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MenuItem, TextField } from '@mui/material'

const useStyles = makeStyles()({
  root: {
    margin: 0,
    marginLeft: 10,
    minWidth: 150,
  },
})

export default function CladeSelector({
  clades,
  clade,
  onChange,
}: {
  clades?: Map<string, Set<number>>
  clade: string
  onChange: (value: string) => void
}) {
  const { classes } = useStyles()

  return clades ? (
    <TextField
      select
      name="clade"
      label="Clade"
      variant="outlined"
      className={classes.root}
      value={clade}
      onChange={event => {
        onChange(event.target.value)
      }}
    >
      <MenuItem value="">All clades</MenuItem>
      {[...clades.keys()].map(key => (
        <MenuItem key={key} value={key}>
          {key}
        </MenuItem>
      ))}
    </TextField>
  ) : null
}
