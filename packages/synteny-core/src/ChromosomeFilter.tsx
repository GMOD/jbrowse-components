import { makeStyles } from '@jbrowse/core/util/tss-react'
import HelpIcon from '@mui/icons-material/Help'
import { InputAdornment, TextField, Tooltip } from '@mui/material'

const useStyles = makeStyles()({
  // Wide enough for `*_MATERNAL` plus room to see a two-name list, and narrow
  // enough that the assembly dropdown beside it stays its row's main object.
  chromosomeFilter: {
    minWidth: 180,
  },
})

// What the box accepts, which the placeholder can only hint at (review: "add
// 'help' boxes for the chromosome lists, so that users can see, there are tricks
// like this wildcard"). The glob is the whole reason a typed box beat a picker
// here, and a reader who does not already know it reads the placeholder's
// `*_MATERNAL` as an example NAME.
const CHROMOSOME_FILTER_HELP =
  'Sequence names to keep, comma separated. A name may be a glob: *_MATERNAL ' +
  'takes every sequence whose name ends that way, and chr1* every one that ' +
  'starts with it. Leave it empty for the whole assembly.'

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
      slotProps={{
        htmlInput: { 'data-testid': testId },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <Tooltip title={CHROMOSOME_FILTER_HELP} arrow>
                <HelpIcon
                  sx={{ fontSize: '1rem', color: 'text.secondary' }}
                  data-testid={testId ? `${testId}-help` : undefined}
                />
              </Tooltip>
            </InputAdornment>
          ),
        },
      }}
      label={label}
      value={value}
      placeholder="all (e.g. *_MATERNAL)"
      size="small"
      // Against the theme's `standard` default (review: "i tend to prefer input
      // boxes to use outlined style"). It sits beside an assembly dropdown,
      // which draws its own outline, so an underlined box next to it read as
      // page text with a rule under it rather than as a field. Set here rather
      // than on the theme, which would restyle every TextField in the app and
      // move every figure with a form in it.
      variant="outlined"
      onChange={event => {
        onChange(event.target.value)
      }}
    />
  )
}
