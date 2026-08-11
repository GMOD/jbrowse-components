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
  onChange,
}: {
  label: string
  value: string
  onChange: (arg: string) => void
}) {
  const { classes } = useStyles()
  return (
    <TextField
      className={classes.chromosomeFilter}
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

/**
 * Split a chromosome box into the entries `selectNamedRegions` takes.
 * Comma-separated, because the two things a user types here are one glob
 * (`*_MATERNAL`) or a short explicit list (`chr1, chr2`), and neither wants
 * punctuation ceremony. Only the comma splits, so an HLA allele name — which
 * carries both `*` and `:` — survives intact.
 *
 * Whitespace-trimmed and empties dropped, so a trailing comma or a box holding
 * only spaces is the same as an empty box: no restriction, whole assembly.
 */
export function parseRegionNames(value: string) {
  return value
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')
}
