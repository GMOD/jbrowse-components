import { LabeledCheckbox, NumberTextField } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { HelpTooltip } from '@jbrowse/synteny-core'
import { Button } from '@mui/material'

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

// Narrow both panels to the slice of the alignment the user is looking at,
// rather than framing them on the whole block's endpoints. Offered by the
// pairwise launch, where the clicked block can be far wider than the view.
//
// Two labels because the two ways of resolving that slice are worth telling
// apart: with a CIGAR the alignment is walked base by base, and without one the
// block is interpolated across — which is all its straight ribbon claims anyway,
// but is an estimate rather than a mapping and shouldn't be worded as one.
export function ClipToRegionCheckbox({
  hasCigar,
  checked,
  onChange,
}: {
  hasCigar: boolean
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
        hasCigar ? (
          'Use CIGAR to map the current visible region to the target'
        ) : (
          <span>
            Clip the panels to the current visible region{' '}
            <HelpTooltip help="This alignment carries no CIGAR, so the matching interval on the target is estimated by interpolating across the block — the same straight line its ribbon is drawn as" />
          </span>
        )
      }
    />
  )
}

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

// The launching view's own tracks, carried onto the panel for its assembly (see
// anchorPanelTracks). On by default — it is the state the user is already
// looking at, and the alternative is reopening those tracks by hand in a panel
// that just opened blank — but it is a checkbox rather than unconditional
// because the copy costs a second fetch of everything open, which is a real
// price when what's open is a BAM.
export function CopySourceTracksCheckbox({
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
          Copy this view&apos;s tracks into its panel{' '}
          <HelpTooltip help="The panel for the assembly you launched from opens with the tracks open here; the other panels open empty, since nothing here says what they should show" />
        </span>
      }
    />
  )
}

// A mate panel gets no tracks, so every such row would open on the ~90px "No
// tracks active / Open track selector" block — on a five-row stack more of the
// viewport than the ribbons the launch was for. Collapsed to rulers by default,
// with this to opt out; a row also expands from its own MiniControls afterwards.
// A row that has tracks (the anchor, when the copy above is on) is unaffected.
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

// The second way out of a launch dialog: put the synteny view in the slot the
// launching view occupies instead of appending it below. A launch is anchored on
// the assembly and locus the source view is already showing, so keeping both
// leaves two views of the same place stacked — and the synteny view, being twice
// as tall, opens mostly below the fold.
//
// A button rather than a checkbox, matching CollapseIntronsDialog, which offers
// the same choice on the same terms: the two outcomes are different enough to
// name, and neither is the setting the other is a variation of.
//
// `type="button"` because SubmitForm renders this inside its <form>, where an
// unset type means submit and the click would run BOTH actions.
export function ReplaceCurrentViewButton({
  disabled,
  onClick,
}: {
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="contained"
      color="primary"
      disabled={disabled}
      onClick={() => {
        onClick()
      }}
    >
      Replace current view
    </Button>
  )
}

// Padding added to both sides of every launched panel. `undefined` is a cleared
// or invalid field, which the dialogs turn into a disabled Submit rather than
// silently launching on the default.
//
// Inline-level, like the checkboxes above it, so with an odd number of them it
// shares the last one's line as a second column. Checked at full resolution in
// genomes_synteny/launch_sequence's dialog frame: it reads as a labelled field
// of its own there, so it is left flowing rather than forced onto a new row.
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
