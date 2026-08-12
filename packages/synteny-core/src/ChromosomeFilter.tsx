import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TextField } from '@mui/material'

const useStyles = makeStyles()({
  // Wide enough for `*_MATERNAL` plus room to see a two-name list, and narrow
  // enough that the assembly dropdown beside it stays its row's main object.
  chromosomeFilter: {
    minWidth: 180,
  },
})

/**
 * The subset of an assembly one axis (dotplot) or one row (linear synteny)
 * shows, typed rather than picked.
 *
 * A picker is the obvious shape and the wrong one: the assemblies this exists
 * for are the fragmented ones, so the list to pick from is hundreds of names
 * long and the useful selections are patterns over it rather than hand-checked
 * sets. What goes in the box is exactly what `displayedRegionNames` carries in
 * a session spec, so the UI and the spec are the same strings.
 *
 * The placeholder is the entire documentation, deliberately. An empty box is
 * the common case and every non-fragmented assembly wants it, so this control
 * has to cost nothing to ignore — a helper paragraph under two of these turns a
 * row of two familiar dropdowns into a form with a concept in it.
 */
export default function ChromosomeFilter({
  label,
  value,
  testId,
  onChange,
}: {
  label: string
  value: string
  // on the input itself rather than the wrapper: both boxes on a form share a
  // placeholder, so this is the only stable way for a test or a screenshot spec
  // to say which one it means
  testId?: string
  onChange: (arg: string) => void
}) {
  const { classes } = useStyles()
  return (
    <TextField
      className={classes.chromosomeFilter}
      slotProps={{ htmlInput: { 'data-testid': testId } }}
      label={label}
      value={value}
      placeholder="all (e.g. *_MATERNAL)"
      size="small"
      onChange={event => {
        onChange(event.target.value)
      }}
    />
  )
}
