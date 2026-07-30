import { LabeledCheckbox, NumberTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { HelpTooltip } from '@jbrowse/synteny-core'

// The option fields the launch dialogs carry: the pairwise launch (one clicked
// alignment) and the region launch (every assembly a locus aligns to) ask the
// same questions, so they ask them in the same words. The panel-collapse box is
// only offered by the region launch, where a stack of rows is what makes the
// per-row empty-state block expensive.
export const DEFAULT_WINDOW_SIZE = 1000

const useStyles = makeStyles()({
  formControl: {
    margin: 10,
    border: '1px solid #ccc',
  },
})

export function FlipInvertedTargetsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const { classes } = useStyles()
  return (
    <LabeledCheckbox
      className={classes.formControl}
      size="small"
      checked={checked}
      onChange={val => {
        onChange(val)
      }}
      // the "why" is a tooltip rather than two wrapped lines of dialog: an
      // unflipped inverted panel runs right to left, which is what the reader
      // needs on demand, not permanently
      label={
        <span>
          Horizontally flip inverted targets{' '}
          <HelpTooltip help="Without flipping, an inverted panel's coordinates decrease left to right" />
        </span>
      }
    />
  )
}

// A launch gives no panel any tracks, so every row would open on the ~90px "No
// tracks active / Open track selector" block — on a five-row stack more of the
// viewport than the ribbons the launch was for. Collapsed to rulers by default,
// with this to opt out; a row also expands from its own MiniControls afterwards.
export function CollapsePanelsCheckbox({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const { classes } = useStyles()
  return (
    <LabeledCheckbox
      className={classes.formControl}
      size="small"
      checked={checked}
      onChange={val => {
        onChange(val)
      }}
      label={
        <span>
          Collapse panels to rulers{' '}
          <HelpTooltip help="Each genome row opens as just its ruler until you add tracks to it; expand a row from its own controls at any time" />
        </span>
      }
    />
  )
}

// Padding added to both sides of every launched panel. `undefined` is a cleared
// or invalid field, which the dialogs turn into a disabled Submit rather than
// silently launching on the default.
export function WindowSizeField({
  onChange,
}: {
  onChange: (windowSize: number | undefined) => void
}) {
  return (
    <NumberTextField
      label="Add window size in bp"
      defaultValue={DEFAULT_WINDOW_SIZE}
      onValueChange={val => {
        onChange(val)
      }}
      min={0}
      errorText="Must be a non-negative number"
    />
  )
}
